"use strict";

var RoonApi          = require("node-roon-api"),
    //RoonApiTransport = require('node-roon-api-transport'),
    RoonApiBrowse    = require('node-roon-api-browse'),
    RoonApiSettings  = require('node-roon-api-settings'),
    fs               = require('fs');

const parse = require('csv-parse');
const stringify = require('csv-stringify');

var _core       = undefined;
var _browse     = undefined;
var _output_id  = "";
var _search_str = "";
var _csv_path   = "/home/ben/roonbenchmark/top_bench1.csv";
var _output_path = "/home/ben/roonbenchmark/top_out1.csv";
var _view       = {};
var _next_actions = [];
var _parsed_lines = [];
var _stringifier = stringify({ delimiter: ',' });
var _output_data = [];
var _desired_id = "";
var _cur_line = [];

var roon = new RoonApi({
    extension_id:        'com.roonlabs.searchtest',
    display_name:        'Search test',
    display_version:     '0.1.0',
    publisher:           'Ben Coburn',
    email:               'ben@roonlabs.com',
    website:             'https://roonlabs.com/',

    core_paired: function(core) {
        _core      = core;
        _browse    = _core.services.RoonApiBrowse;
        console.log(core.core_id,
                    core.display_name,
                    core.display_version,
                    "-",
                    "PAIRED");
    },

    core_unpaired: function(core) {
        _core      = undefined;
        console.log(core.core_id,
                    core.display_name,
                    core.display_version,
                    "-",
                    "LOST");
    }
});

var _values = {
    "csv_path": _csv_path,
    "output_path": _output_path
};
var _layout = [
    {
        "type": "zone",
        "title": "Roon output",
        "setting": "outputid"
    },
    {
        "type": "string",
        "title": "search string",
        "setting": "search_str"
    },
    {
        "type": "string",
        "title": "csv path",
        "setting": "csv_path"
    },
    {
        "type": "string",
        "title": "output path",
        "setting": "output_path"
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
            if (_values["outputid"]) {
                _output_id = _values["outputid"]["output_id"];
            }
            if (_values["search_str"] != undefined) {
                _search_str = _values["search_str"];
            }
            if (_values["csv_path"] != undefined) {
                _csv_path = _values["csv_path"];
            }
            if (_values["output_path"] != undefined) {
                _output_path = _values["output_path"];
            }
        }
        req.send_complete("Success", { "settings" :{
            "values" : _values,
            "layout" : _layout
        }});
        if (!isdryrun) {
            if (_search_str != "") {
                _next_actions = [0, 0, 0];
                refresh_browse({ pop_all: true });
            }
            if (_csv_path != "") {
                load_csv();
            }
        }
    }
});

function load_csv() {
    _stringifier = stringify({ delimiter: ',' });
    _output_data = [];
    _stringifier.on('readable', function(){
        let row;
        while(row = _stringifier.read()){
            _output_data.push(row)
        }
    });
    _stringifier.on('finish', function(){
        let output_string = _output_data.join();
        fs.writeFile(_output_path, output_string);
    })
    const parser = parse({
        delimiter: ','
    });
    _parsed_lines = [];
    parser.on('readable', function() {
        let line
        while(line = parser.read()) {
            console.log(line);
            _parsed_lines.push(line);
        }
    });
    parser.on('end', function() {
        _stringifier.write(_parsed_lines.shift());
        test_line();
    });
    fs.readFile(_csv_path, 'utf8', function(err, data) {
        parser.write(data);
        parser.end();
    });
}

function test_line() {
    if (_parsed_lines.length == 0) {
        console.log("parsed lines empty!!!!");
        _stringifier.end();
        return;
    }
    let line = _parsed_lines.shift();
    console.log(line[0]);
    _search_str = line[0].trim();
    _desired_id = line[2];
    _cur_line = line;
    _next_actions = [0, 0, 0];
    refresh_browse({ pop_all: true });
}

function check_result(items) {
    console.log("check result!!!");
    console.log(items);
    let subtitle = items["subtitle"];
    let ids = subtitle.split("|");
    var found = ids.filter(x => _desired_id.split("|").includes(x)).length;
    //var found = ids.includes(_desired_id) ? 1 : 0;
    var out_line = _cur_line.concat([found]);
    console.log(out_line);
    _stringifier.write(out_line);
    test_line();
}

function refresh_browse(opts) {
    opts = Object.assign({
        hierarchy:          "browse",
        zone_or_output_id:  _output_id,
    }, opts);

    _browse.browse(opts, (err, r) => {
        if (err) { console.log(err, r); return; }

        console.log(err, r);

        if (r.action == 'list') {
            _view["list"] = r.list;
            _view["items"] = [];
            var listoffset = r.list.display_offset > 0 ? r.list.display_offset : 0;
            load_browse(listoffset);

        } else if (r.action == 'message') {
            alert((r.is_error ? "ERROR: " : "") + r.message);

        } else if (r.action == 'replace_item') {
            var i = 0;
            var l = _view.items;
            while (i < l.length) {
                if (l[i].item_key == opts.item_key) {
                    l.splice(i, 1, r.item);
                    break;
                }
                i++;
            }
            _view["items"] = l;

        } else if (r.action == 'remove_item') {
            var i = 0;
            var l = _view.items;
            while (i < l.length) {
                if (l[i].item_key == opts.item_key) {
                    l.splice(i, 1);
                    break;
                }
                i++;
            }
            _view["items"] = l;

        } else if (r.action == 'none') {
            check_result(r.list);
        } else {
            console.log("unexpected result from browse, aborting!!!");
        }
    });
}

function load_browse(listoffset) {
    _browse.load({
        hierarchy:          "browse",
        offset:             listoffset,
        set_display_offset: listoffset,
    }, (err, r) => {
        _view["listoffset"] = listoffset;
        _view["items"] = r.items;
        console.log("load_browse, length: " + _next_actions.length);
        if (_next_actions.length != 0) {
            let item = _view.items[_next_actions.shift()];
            var opts = { item_key: item.item_key };
            if (item.input_prompt != undefined) {
                opts.input = _search_str;
            }
            refresh_browse(opts);
        } else {
            check_result(r.list);
        }
    });
}

roon.init_services({
    required_services:   [ RoonApiBrowse ],
    provided_services:   [ svc_settings ]
});

roon.start_discovery();
