"use strict";

var RoonApi          = require("node-roon-api"),
    RoonApiTransport = require('node-roon-api-transport'),
    RoonApiSettings  = require('node-roon-api-settings');

var _core      = undefined;
var _transport = undefined;
var _output_id = "";

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
                            if ((output.output_id == _output_id) &&
                                ((zone.state == "stopped") || (zone.state == "paused"))) {
                                _transport.control(_output_id, "play");
                                _transport.mute(_output_id, "mute");
                                _transport.change_volume(_output_id, "absolute", output.volume.min);
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
        "setting": "0"
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
        if (req.body.settings) {
            if (req.body.settings.values) {
                _values = req.body.settings.values;
            }
            if (req.body.settings.layout) {
                _layout = req.body.settings.layout;
            }
            if (_values["0"]) {
                _output_id = _values["0"]["output_id"];
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
