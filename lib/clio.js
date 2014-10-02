module.exports = function(options) {

var util	= require('util');
var fs      = require('fs');
var tty     = require('tty');

var	OP_TO_STRING = Object.prototype.toString;

options = options || {};

//  Utility functions
//
var $ = {

	// 	##is
	//
	//	@param		{Mixed}		type		An object type.
	// 	@param		{Mixed}		val			The value to check.
	//	@type		{Boolean}
	//
	// Checks whether `val` is of requested `type`.
	//
	"is" : function(type, val) {

		if(!type || val === void 0) {
			return false;
		}

		var p;

		switch(type) {
			case Array:
				return OP_TO_STRING.call(val) === '[object Array]';
			break;

			case Object:
				return OP_TO_STRING.call(val) === '[object Object]';
			break;

			case "numeric":
				return !isNaN(parseFloat(val)) && isFinite(val);
			break;

			case "element":
				return val.nodeType === 1;
			break;

			case "emptyObject":
				for(p in val) {
					return false;
				}
				return true;
			break;

			default:
				return val.constructor === type;
			break;
		}
	},
	
	noop    : function() {}
};

//  See initialization at bottom, where #attributes, #fgcolors, #bgcolors collections
//  are re-mapped with pre-compiled terminal codes.
//
var attributes	= {
	reset		: 0,
	bright		: 1,
	dim			: 2,
	underscore	: 4,
	blink		: 5,
	reverse		: 7,
	hidden		: 8
};

var fgcolors 	= {
    default : 39,
	black	: 30,
	red		: 31,
	green	: 32,
	yellow	: 33,
	blue	: 34,
	magenta	: 35,
	cyan	: 36,
	white	: 37
};

var padRight = function(padstr, len, s) {
	while(s.length < len) {
		s += padstr;
	}

	return s;
};

//	Capitalizes the first character of all words in a string.
//
// 	@type         {String}
//
var ucwords	= function(s) {

    var w 	= s.split(' ');
    var i;

    for(i=0; i < w.length; i++) {
        w[i] = w[i].charAt(0).toUpperCase() + w[i].substring(1);
    }

    return w.join(" ");
};

//  See initialization at bottom, where this collection is derived from #fgcolors
//
var bgcolors 	= {};

var chars   = {
    'top'           : '━',
    'top-mid'       : '┳',
    'top-left'      : '┏',
    'top-right'     : '┓',
    'bottom'        : '━',
    'bottom-mid'    : '┻',
    'bottom-left'   : '┗',
    'bottom-right'  : '┛',
    'left'          : '┃',
    'left-mid'      : '┣',
    'mid'           : '━',
    'mid-mid'       : '╋',
    'right'         : '┃',
    'right-mid'     : '┫'
};

//  ##_pre
//
//  Utility method to add escape prefix to a command.
//
var _pre = function(c, asStr) {

    c = '\x1B[' + (c || "");

    if(!asStr) {
        util.print(c);
    }

    return c;
};

//Position the Cursor to x/y
var to = function(x, y, s) {
    return _pre(x + ';' + y + 'H', s);
};

//Move the cursor up n rows
var up = function(n, s) {
    return _pre((n || 1) + 'A', s);
};

//Move the cursor down x rows
var down = function(n, s) {
    return _pre((n || 1) + 'B', s);
};

//Move the cursor forward x rows
var forward = function(n, s) {
    return _pre((n || 1) + 'C', s);
};

//Move the cursor backwards x columns
var back = function(n, s) {
    return _pre((n || 1) + 'D', s);
};

//Clear the entire screen
var clear = function(s) {
    return _pre('2J', s);
};

//Clear the entire screen
var clearDown = function(s) {
    return _pre('J', s);
};

//Clear the entire screen
var clearUp = function(s) {
    return _pre('1J', s);
};

//Clear the current line
var clearLine = function(s) {
    return _pre('2K', s);
};

var clearForward = function(s) {
    return _pre('K', s);
};

var clearBack = function(s) {
    return _pre('1K', s);
};

//	Will return terminal code producing foreground color reqested.
//
//	@param		{String}	c		A key present in #fgcolors map.
//
var fgCode = function(c) {
	return fgcolors[c] || "";
}

//	Will return terminal code producing background color reqested.
//
//	@param		{String}	c		A key present in #bgcolors map.
//
var bgCode = function(c) {
	return bgcolors[c] || "";
}

//	Will return terminal code setting attribute reqested.
//
//	@param		{String}	a		A key present in #attributes map.
//
var attCode = function(a) {
	return attributes[a] || "";
}

//  ##stop
//
//  Internal. Stops further execution. Used for --version and --help.
//
var stop    = function() {
    process.exit();
};

//  ##detokenize
//
//  Replace
var detokenize = function(str) {
    return str.replace(/@[_!]?(black|red|green|yellow|blue|magenta|cyan|white)/g, "").replace(/@@/g, "").replace(/`/g, "\n");
};

//  ##write
//
//  Backtick (`) creates a newline.
//
var write = function(str) {

    util.print(prepare(str));
};

//	##prepare
//
var prepare = function(str) {

	var x;

	str = str.toString().trim()

	//	Handle terminators.
	//
	str = str.replace(/@@/g, attCode("reset", 1));

	//	Run token replacements.
	// 	#([^#]+)
	//
	for(a in fgcolors) {
		str = str.replace(new RegExp("@" + a, "g"), fgcolors[a]);
		str = str.replace(new RegExp("@_" + a, "g"), bgcolors[a]);
	}

	//	Run attribute replacements.
	// 	#([^#]+)
	//
	for(a in attributes) {
		str = str.replace(new RegExp("@!" + a, "g"), attCode(a, 1));
	}

	//	[1K 		> Erase to start of line
	//	[1000D		> Move back 1000 columns (fuzzy way of forcing to 0 column)
	//
	//	Encode colors and write message, resetting attributes on term.
	//
	//	\x1B[1K\x1B[1000D
	//
    str = str.replace(/`/g, "\n" + (options.useLines ? (options.useLines++ + "\t ") : ""));

    //	Always add a terminating tail to the string.
    //
    str += attCode("reset", 1);

    return str;
};

var version	= function(vn) {

    if(!vn) {
        return;
    }

    option("--version", {
        description : "Fetch the current version number.",
        action      : function() {
            write("@_blue@white Version: " + vn + " @@`");
            stop();
        }
    });
};

//  ##option
//
//  Ultimately an option object looks like this:
//  {   flags           :   "-one -or --more ##flags",
//      [description]   :   "A string which should helpfully describe the option.",
//      [test]          :   A RegExp that validates the value passed to this option.
//      [default]       :   The default value if no value is sent. If no default is set the
//                          option is automatically set to Boolean `true`.
//      [action]        :   A Function which receives the option value as soon as it is
//                          received. }
//
//  -   You may send #option an object as described above.
//  -   You may also send just a flag and a description, as two String arguments:
//      clio.option("-f", "The description");
//  -   You may send a flag string, and an object exactly like above object -except- that
//      the #flags attribute is omitted.
//  -   You may send an Object containing multiple options, which option values may also take
//      either a string on an object not unlike above object, excepting the need to send
//      a #flags attribute.
//
var option = function(flag, desc) {

    var f;

    var setOption = function(op) {
        var fS = op.flags.split(" ");
        options._optionMap[fS[0]] = [];
        fS.forEach(function(e) {
            options._optionMap[fS[0]].push(e);
            options._options[e] = {
                description	: op.description || "[none]",
                test		: $.is(RegExp, op.test) ? op.test : void 0,
                default		: op.default || true,
                action		: $.is(Function, op.action) ? op.action : $.noop,
                values		: []
            }
        });
    }

    var descStrOrObj = function(fl, d) {
        if($.is(String, d)) {
            setOption({
                flags       : fl,
                description : d
            })
        } else if($.is(Object, d)) {
            d.flags = fl;
            setOption(d);
        }
    };

    if($.is(Object, flag)) {
        if(flag.flags) {
            setOption(flag);
        } else {
            for(f in flag) {
                descStrOrObj(f, flag[f]);
            }
        }
    } else if($.is(String, flag)) {
        descStrOrObj(flag, desc);
    }
};

//	Receive and implement process boot _options.
//
//  @param  {Mixed}     [av]   Default is to parse process.argv. You may also pass a
//                              space-separated string, or an array.
//
var parse = function(av) {

	//	Reverse the args, such that option flags will follow values, so that we can
	//	trigger processing on encountering an option flag, accumulating values.
	//
	var args =  ($.is(String, av)
	                ? av.split(" ")
	                : $.is(Array, av)
	                    ? av
	                    : process.argv.slice(2)).reverse();
	var o 		= options;
	var cmd		= void 0;
	var vals	= [];
	var arg;

	var proc = function() {

		var oc;
		if(cmd) {
			oc = options._options[cmd];

			if(oc) {
				//	Sanitize values. If no values, use default _option value, which is
				//	*always* true unless specified otherwise.
				//
				if(vals.length === 0) {

					oc.values = oc.default;

				} else {

					if(oc.test) {
						oc.values = vals.filter(function(e) {
							return new String(e).match(oc.test)
						});
					} else {
						oc.values = vals;
					}

					//	If only a single value, lose array
					//
					if(oc.values.length === 1) {
						oc.values = oc.values[0];
					}
				}

				//	Execute any requested action. Note that this is always set to a function,
				//	#noop if not sent during the initialization.
				//
				oc.action(oc.values, oc);
			}
		}

		//	Reset, as a _option has been processed.
		//
		cmd		= void 0;
		vals 	= [];
	};

	//	Run through all atoms passed, accumulating values, and storing the
	//	_option->values tuple when an _option flag is encountered. Note unshift of values
	//	in order to keep the value order correct (working on a reversed array).
	//
	args.forEach(function(arg) {
	
		if(arg.indexOf("=") > -1) {

			arg		= arg.split("=");
			cmd		= arg[0];
			if(arg[1]) {
				vals.unshift(arg[1]);
			} else {
				throw new Error(arg + " has been assigned a null value.");
			}
			proc();

		} else if(options._options[arg]) {

			cmd = arg;
			proc();

		} else {

			vals.unshift(arg);
		}
	});

	proc();
	
	return this;
};


//  ##get
//
//  Retrieve the value of an option key.
//
//  @example    clio.get("--version");
//
var get = function(cmd) {
	var ret;
	var i;
	var c = options._optionMap[cmd] || [];
	var n;

	//	Go through all aliased _options, store the first non-empty value found and exit loop.
	//
	for(i=0; i < c.length; i++) {

		n = options._options[c[i]].values;

		if($.is(Array, n)) {
			if(n.length > 0) {
				ret = n;
				break;
			}
		} else if(n !== void 0) {
			ret = n;
			break;
		}
	}

	//	If the clio argument is numeric, return the value as a true numeric value.
	//
	ret = $.is("numeric", ret) ? parseFloat(ret) : ret;

	return ret === void 0 ? null : ret;
};

//  ##prompt
//
//  Request user input. Sends input to #cb.
//
var prompt = function(question, cb) {
    clio.write(question);
    process.stdin.setEncoding('utf8');
    process.stdin
        .once('data', function(input){
            cb && cb(input);
        })
        .resume();
};

//  Initialize.
//  Parse kit startup options, initialize clio option collections.
//
(function(o) {

	var op = options;
	var c;
	var p;
    var x;

    //  Precalculate fg/bg/att codes. Since fg/bg use the same set of color names, only
    //  need to run through fg colors.
	//
	for(x in fgcolors) {

		bgcolors[x] = fgcolors[x] + 10;

		fgcolors[x] = _pre(fgcolors[x] + 'm', 1);
		bgcolors[x] = _pre(bgcolors[x] + 'm', 1);
	}

	for(x in attributes) {
	    attributes[x] = _pre(attributes[x] + 'm', 1);
	}

	op.useLines		= o.useLines === void 0 ? false : !!o.useLines;

	op._options		= {};
	op._optionMap   = {};

    version(o.version);
    option(o.options || {});

    option("-o --output", {
        description : "A file to write output to",
        action      : function(fn, op) {
            //  If a file output was requested, create a write stream and replace the
            //  value of "-o" with that stream reference.  Note that this is synchronous,
            //  and will terminate further execution if stream cannot be created.
            //
            op.values = fs.createWriteStream(fn);
        }
    });
    option("--help", {
        description : "Show this help file",
        action      : function() {

            var om      = options._optionMap;
            var op      = options._options;
            var str     = "";
            var mwidth  = 0;
            var p;

            for(p in om) {
                mwidth = Math.max(mwidth, om[p].join(" ").length);
            }

            for(p in om) {
                str += "@blue" + padRight(" ", mwidth, om[p].join(" ")) + "\t@green" + op[p].description + "@@`"
            }

            write(str);
            stop();
        }
    });
})(options);

var clio = {
	write			: write,
	prepare			: prepare,
	detokenize  	: detokenize,
	parse			: parse,
	option			: option,
	version			: version,
	prompt      	: prompt,
	"get"			: get,

	to          	: to,
	up          	: up,
	down        	: down,
	forward     	: forward,
	back        	: back,
	clear       	: clear,
	clearDown   	: clearDown,
    clearUp     	: clearUp,
    clearLine   	: clearLine,
    clearForward	: clearForward,
    clearBack  		: clearBack
}

//	Add direct methods for colors (fg && bg) and attributes.
//	Ie. .red() - .bgRed() - .blink()
//
var v;
var rf = function(meth, c) {
	return function() {
		util.print(meth(c));
	}
}

for(v in fgcolors) {
	clio[v] = rf(fgCode, v);
	clio["bg" + ucwords(v)] = rf(bgCode, v)
};

for(v in attributes) {
	clio[v] = rf(attCode, v)
};


return clio;

}; 

