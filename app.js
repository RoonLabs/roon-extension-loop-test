"use strict";

var RoonApi          = require("node-roon-api"),
    RoonApiTransport = require('node-roon-api-transport'),
    RoonApiSettings  = require('node-roon-api-settings');

var _core      = undefined;
var _transport = undefined;
var _output_id = "";
var _mode      = false;
var _interval  = 5000;
var _timer     = null;

var roon = new RoonApi({
    extension_id:        'com.roonlabs.looptest',
    display_name:        'Loop test',
    display_version:     '0.1.0',
    publisher:           'Ben Coburn',
    email:               'ben@roonlabs.com',
    website:             'https://roonlabs.com/',

    core_paired: function(core) {
        _core      = core;
        _transport = _core.services.RoonApiTransport;
        console.log(core.core_id,
                    core.display_name,
                    core.display_version,
                    "-",
                    "PAIRED");
        
        _transport.subscribe_zones(function(cmd, data) {
            if (cmd == "Changed") {
                if (data.zones_changed) {
                    data.zones_changed.forEach(zone => {
                        zone.outputs.forEach(output => {
                            if (output.output_id == _output_id) {
                                if ((_mode == "\"skip\"") || (_mode == "skip")) {
                                    if (_timer == null) {
                                        _timer = setInterval(() => {
                                            if (_transport) {
                                                _transport.control(_output_id, "next");
                                            }
                                        }, _interval);
                                    }
                                } else if ((_mode == "\"seek\"") || (_mode == "seek")) {
                                    console.log(zone.now_playing);
                                    console.log(zone.now_playing.seek_position !== undefined);
                                    if (((zone.now_playing != undefined) && (zone.now_playing.seek_position !== undefined) && (zone.now_playing.length != undefined)) &&
                                        ((zone.now_playing.seek_position == null) ||
                                         ((zone.now_playing.length - zone.now_playing.seek_position) > 1))) {
                                        console.log("seek mode triggered");
                                        _transport.seek(_output_id, "absolute", zone.now_playing.length - 1);
                                    }
                                }
                            }

                            });
                    });
                }
            }
            
        });
        
    },

    core_unpaired: function(core) {
        _core      = undefined;
        _transport = undefined;
        console.log(core.core_id,
                    core.display_name,
                    core.display_version,
                    "-",
                    "LOST");
    }
});

var _values = { };
var _layout = [
    {
        "type": "zone",
        "title": "Roon output number 1",
        "setting": "outputid"
    },
    {
        "type": "string",
        "title": "test mode",
        "setting": "mode"
    },
    {
        "type": "integer",
        "title": "next interval, in MS",
        "min": 100,
        "max": 20000,
        "setting": "interval"
    }
];


var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb( {
            "values" : _values,
            "layout" : _layout
        });
    },
    save_settings: function(req, isdryrun, ignored) {
        console.log(req);
        clearInterval(_timer);
        _timer = null;
        if (req.body.settings) {
            if (req.body.settings.values) {
                _values = req.body.settings.values;
            }
            if (req.body.settings.layout) {
                _layout = req.body.settings.layout;
            }
            if (_values["outputid"]) {
                _output_id = _values["outputid"]["output_id"];
            }
            if (_values["interval"]) {
                _interval = _values["interval"];
            }
            if (_values["mode"] != undefined) {
                _mode = _values["mode"];
            }
        }
        req.send_complete("Success", { "settings" :{
            "values" : _values,
            "layout" : _layout
        }});
    }
});

roon.init_services({
    required_services:   [ RoonApiTransport ],
    provided_services:   [ svc_settings ]
});

roon.start_discovery();
