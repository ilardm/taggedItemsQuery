$(document).ready(function() {
    console.log( "i'm ready now!" );

    var apiCallInterval = 1000 / 5
    var throttle = function( fn, delay ) {
        var now = (new Date()).getTime();
        var nextExec = window.THROTTLE_NEXT_EXEC;
        if ( nextExec === undefined ) {
            nextExec = now - delay;
        }
        var timeout = nextExec + delay - now;
        window.THROTTLE_NEXT_EXEC = now + timeout;

        setTimeout( function() {
            fn();
        }, timeout);
    }

    var lsPrefix = "taggedItemsQuery_";
    var lsget = function(key) {
        return localStorage.getItem( lsPrefix + key );
    }
    var lsset = function(key, value) {
        localStorage.setItem( lsPrefix + key, value );
    }

    var onApiResponse = function(data) {
        console.log(data);
    }
    var onApiError = function(code, message) {
        console.log(code + " - " + message);
    }

    var cache = new LastFMCache();
    var lastfm = new LastFM({
        apiKey    : '8f35b45c7fff3cbd3c340ee0ee0a80a2',
        apiSecret : 'e98471405d2eb3c1b02c10dea7c30ec2',
        cache     : cache
    });

    var DATACACHE = { artists: {},
                      tracks: {},
                      tags: []
                    };
    var DATACACHEALT = { artists: [],
                         tracks: []
                       };
    var dataCacheAltSync = function() {
        var objToArrConverter = function(obj) {
            return Object.keys( obj ).map( function(itm) {
                return obj[itm];
            });
        }

        DATACACHEALT.artists = objToArrConverter( DATACACHE.artists );
        DATACACHEALT.tracks = objToArrConverter( DATACACHE.tracks );
    }
    var dataCacheStr = lsget("datacache");
    var lastCache = parseInt( lsget("lastcache") );
    var cacheAgeThreshold = 1000 * 60 * 60 * 24 * 7;
    if ( dataCacheStr !== null ) {
        DATACACHE = JSON.parse( dataCacheStr );

        dataCacheAltSync();
    }

    var lastfmUser = "aid9990";

    // ---------------------------------------------------------------

    var processTopTags = function(data, getter, setter) {
        var tags = getter("tags");

        data.toptags.tag.forEach(function(tag) {
            if ( tags.indexOf( tag.name ) == -1 ) {
                tags.push( tag.name );
            }

            if ( DATACACHE.tags.indexOf( tag.name ) == -1 ) {
                DATACACHE.tags.push( tag.name );
            }
        });

        setter("tags", tags);
    }

    var processTopTagsOfArtist = function(data, artist) {
        processTopTags(data, function(key) {
            return DATACACHE.artists[artist][key];
        }, function(key, value) {
            DATACACHE.artists[artist][key] = value;

            var idx = DATACACHEALT.artists.indexOf( DATACACHE.artists[artist] );
            if ( idx >= 0 ) {
                DATACACHEALT.artists[idx][key] = value;
            }
        });
    }

    var processTopTagsOfTrack = function(data, track) {
        processTopTags(data, function(key) {
            return DATACACHE.tracks[track][key];
        }, function(key, value) {
            DATACACHE.tracks[track][key] = value;

            var idx = DATACACHEALT.tracks.indexOf( DATACACHE.tracks[track] );
            if ( idx >= 0 ) {
                DATACACHEALT.tracks[idx][key] = value;
            }
        });
    }

    var requestArtistTags = function(artistName) {
        if ( DATACACHE.artists[artistName] === undefined ) {
            var artistObj = { name: artistName,
                              tags: []
                            };
            DATACACHE.artists[artistName] = artistObj;
            DATACACHEALT.artists.push( artistObj );

            throttle(function(){
                lastfm.artist.getTopTags( { "artist": artistName},
                                          { "success": function(data) {
                                              processTopTagsOfArtist(data, artistName);
                                          },
                                            "error": onApiError
                                          });
            }, apiCallInterval);
        }
    }

    var processTopArtists = function(data) {
        data.topartists.artist.forEach(function(artist) {
            requestArtistTags(artist.name);
        });
    }

    var processTopTracks = function(data) {
        data.toptracks.track.forEach(function(track) {
            if ( DATACACHE.tracks[track.name] === undefined ) {
                var trackObj = { name: track.name,
                                 artist: track.artist.name,
                                 tags: []
                               };
                DATACACHE.tracks[track.name] = trackObj;
                DATACACHEALT.tracks.push( trackObj );

                if ( DATACACHE.artists[track.artist.name] === undefined ) {
                    requestArtistTags(track.artist.name);
                }

                throttle(function(){
                    lastfm.track.getTopTags( { "artist": track.artist.name,
                                               "track": track.name
                                             },
                                             { "success": function(data) {
                                                 processTopTagsOfTrack(data, track.name);
                                             },
                                               "error": onApiError
                                             });
                }, apiCallInterval);
            }
        });
    }

    // ---------------------------------------------------------------

    var performQuery = function(program, mode) {
        var thresholdConverter = function(value, threshold) {
            if ( value > 0 ) {
                return threshold;
            } else if ( value < 0 ) {
                return -threshold;
            }
            return 0;
        }

        var usageThreshold = 1000 * 60 * 20;

        var ret = program.map( function(line) {
            var qsource = DATACACHEALT[mode];

            qsource = qsource.map( function(itm) {
                itm.score = line.reduce( function(prev, curr) {
                    var idx = itm.tags.indexOf( curr );

                    return prev + ( idx >= 0 ? 1 : 0);
                }, 0);

                return itm;
            });

            qsource = qsource.filter( function(itm) {
                return itm.score > 0;
            });

            qsource = qsource.sort( function(a, b) {
                var scoreIdx = thresholdConverter(a.score - b.score, -1);       // reverse sort

                var usageIdx = 0;
                if ( a.lastUsage !== undefined
                     && b.lastUsage !== undefined
                   ) {
                    usageIdx = thresholdConverter(a.lastUsage - b.lastUsage, -2);       // reverse sort
                }

                var ret = scoreIdx + usageIdx;

                return ret;
            });

            var now = (new Date()).getTime();
            qsource = qsource.filter( function(itm) {
                if ( itm.lastUsage !== undefined ) {
                    return now - itm.lastUsage > usageThreshold;
                }

                return true;
            });

            return qsource;
        });

        var nowUsage = (new Date()).getTime();
        ret = ret.reduce( function(prev, curr) {
            var notInPrev = curr.filter( function(ci) {
                return !prev.some( function(pi) {
                    return pi.name === ci.name;
                });
            });

            if ( notInPrev.length > 0 ) {
                var itemInUse = notInPrev[0];

                DATACACHE[mode][itemInUse.name].lastUsage = nowUsage;
                prev.push( itemInUse );
            }

            return prev;
        }, []);

        dataCacheAltSync();

        return ret;
    }

    // ---------------------------------------------------------------

    var runProgramFunction = function(piwContainer, fillResults) {
        var mode = piwContainer.find(".tw-mode-select")[0].value;
        var textTransformer = function(res) {
            return res.toString();
        };

        if ( mode === "artists" ) {
            textTransformer = function(res) {
                return res.name;
            }
        } else if ( mode === "tracks" ) {
            textTransformer = function(res) {
                return res.artist + " - " + res.name;
            }
        }

        var program = [];

        piwContainer.find(".tw-horizontal-container-content").each( function(idx, hc) {
            var line = [];
            $(hc).find(".tw-input-field").each( function(idx, ifld) {
                if ( ifld.value ) {
                    line.push( ifld.value );
                }
            });
            program.push( line );
        });

        var result = performQuery( program, mode );
        fillResults(result, textTransformer);
    }

    var buildProgramInputWidget = function() {
        var container = $("<div>", {"class": "tw-container"});
        var modeSelect = $("<select>", {"class": "tw-mode-select form-control"});
        var verticalContainer = $("<div>", {"class": "tw-container tw-vertical-container"});
        var verticalContainerContent = $("<span>", {"class": "tw-container tw-vertical-container-content"});
        var horizontalContainer = $("<div>", {"class": "tw-container tw-horizontal-container"});
        var horizontalContainerContent = $("<span>", {"class": "tw-container tw-horizontal-container-content"});
        var addButton = $("<button>", {"class": "btn"}).append( $("<span>", {"class": "glyphicon glyphicon-plus"}) );
        var removeButton = $("<button>", {"class": "btn"}).append( $("<span>", {"class": "glyphicon glyphicon-remove"}) );
        var inputField = $("<input>", {"type": "text", "class": "tw-input-field"});
        var inputFieldContainer = $("<span>", {"class": "tw-container tw-input-field-container"});

        var buildRow = function() {
            var hc = horizontalContainer.clone();
            var hcc = horizontalContainerContent.clone();
            var ab = addButton.clone().addClass("btn-default").click( function() {
                var ifc = inputFieldContainer.clone();
                var ifld = inputField.clone().autocomplete({source: DATACACHE.tags});
                var rb = removeButton.clone().addClass("btn-default").click( function() {
                    ifc.remove();
                });

                hcc.append( ifc.append(ifld).append(rb) );
            });
            var rb = removeButton.clone().addClass("btn-primary").click( function() {
                hc.remove();
            });

            hc.append( hcc ).append( ab ).append( rb );

            return hc;
        }

        var addRowBtn = addButton.clone().addClass("btn-primary").click( function() {
            verticalContainerContent.append( buildRow() );
        });

        modeSelect.append( $("<option>").val("artists").text("Artists") )
            .append( $("<option>").val("tracks").text("Tracks") );

        verticalContainerContent.append( buildRow() );
        verticalContainer.append( verticalContainerContent ).append( addRowBtn );
        container.append( modeSelect ).append( verticalContainer );

        return container;
    }

    var fillResultsFunction = function(prwContainer, results, resultTextTransformer, fillInfoFunction) {
        var ul = $( prwContainer.find(".prw-list")[0] );
        ul.empty();

        results.forEach( function(res) {
            var li = $("<li>").text( resultTextTransformer(res) )
                .click( function() {
                    fillInfoFunction(res);
                });
            ul.append( li );
        });
    }

    var buildProgramResultWidget = function() {
        var container = $("<div>", {"class": "prw-container"});
        var ul = $("<ul>", {"class": "prw-list"});

        container.append( ul );

        return container;
    }


    var fillResultItemInfoFunction = function(riiwContainer, result, textConverter) {
        var textContainer = $( riiwContainer.find(".rii-text-container")[0] );
        textContainer.text( textConverter(result) );

        var ul = $( riiwContainer.find(".rii-list")[0] );
        ul.empty();

        result.tags.forEach( function(tag) {
            var li = $("<li>").text( tag );
            ul.append( li );
        });
    }

    var buildResultItemInfoWidget = function() {
        var container = $("<div>", {"class": "rii-container"});
        var text = $("<div>", {"class": "rii-container rii-text-container"});
        var ul = $("<ul>", {"class": "rii-list"});

        container.append( text ).append( ul );

        return container;
    }

    var buildProgramWidget = function(runFunction, showResultsFunction, fillInfoFunction) {
        var container = $("<div>", {"class": "pw-container row"});
        var piw = buildProgramInputWidget();
        var prw = buildProgramResultWidget();
        var riiw = buildResultItemInfoWidget();
        var runButton = $("<button>", {"class": "btn btn-success"})
            .append( $("<span>", {"class": "glyphicon glyphicon-play"}) )
            .click( function() {
                runFunction(piw, function(res, conv) {
                    showResultsFunction(prw, res, conv, function(res) {
                        fillResultItemInfoFunction(riiw, res, conv);
                    });
                });
            });

        container.append( piw.addClass("col-md-4") )
            .append( prw.addClass("col-md-4") )
            .append( riiw.addClass("col-md-4") )
            .append( runButton );

        return container;
    }

    var buildProgramWidgetContainer = function() {
        var container = $("<div>", {"class": "container"});
        var contentContainer = container.clone();
        var addButton = $("<button>", {"class": "btn btn-info"}).append( $("<span>", {"class": "glyphicon glyphicon-plus"}) );

        addButton.click( function() {
            contentContainer.append( buildProgramWidget( runProgramFunction, fillResultsFunction ) );
        });
        contentContainer.append( buildProgramWidget( runProgramFunction, fillResultsFunction ) );
        container.append( contentContainer ).append( addButton );

        return container;
    }

    // ---------------------------------------------------------------

    if ( isNaN(lastCache)
         || ( !isNaN(lastCache)
              && (new Date()).getTime() - lastCache > cacheAgeThreshold
            )
       ) {
        throttle(function(){
            lastfm.user.getTopArtists( {"user": lastfmUser,
                                        "period": "3month",
                                       },
                                       { "success": processTopArtists,
                                         "error": onApiError
                                       }
                                     );
        }, apiCallInterval);

        throttle(function(){
            lastfm.user.getTopTracks( {"user": lastfmUser,
                                       "period": "3month",
                                      },
                                      { "success": processTopTracks,
                                        "error": onApiError
                                      }
                                    );
        }, apiCallInterval);

        lastCache = (new Date()).getTime();
    }

    $("#home").append( buildProgramWidgetContainer() );

    // ---------------------------------------------------------------

    $(window).unload( function() {
        lsset("datacache", JSON.stringify( DATACACHE ) );
        lsset("lastcache", lastCache );
    });
});
