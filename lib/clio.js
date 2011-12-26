(function () {

var util	= require("util");

var clio    = {};
var options = {};

if(typeof module !== 'undefined' && module.exports) {
    module.exports = clio;
} else {
    this.clio = clio;
}

//	Some basic colorization for terminal. TODO: in-string token parser.
//
var print = function(str, fg, bg, att) {

	var defFg 		= fg 	|| options.defaultFg 	|| false;
	var defBg 		= bg 	|| options.defaultBg 	|| false;
	var defAtt	 	= att 	|| options.defaultAtt	|| false;

	var bgcolors 	= {};
	var x;

	//	These will be internal. TODO: parse #str to find tokens.
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
		black	: 30,
		red		: 31,
		green	: 32,
		yellow	: 33,
		blue	: 34,
		magenta	: 35,
		cyan	: 36,
		white	: 37
	}

	//	Add lookup for background colors.
	//
	for(x in fgcolors) {
		bgcolors[x] = fgcolors[x] + 10;
	}

	str = fgCode(defFg) + bgCode(defBg) + attCode(defAtt) + str.toString().trim()

	//	Handle terminators.
	//
	str = str.replace("@@", attCode("reset") + fgCode(defFg) + bgCode(defBg) + attCode(defAtt));

	//	Run token replacements.
	// 	#([^#]+)
	//
	for(a in fgcolors) {
		str = str.replace("@" + a, fgCode(a));
		str = str.replace("@_" + a, bgCode(a));
	}

	//	Run attribute replacements.
	// 	#([^#]+)
	//
	for(a in attributes) {
		str = str.replace("@!" + a, attCode(a));
	}

	//	[1K 		> Erase to start of line
	//	[1000D		> Move back 1000 columns (fuzzy way of forcing to 0 column)
	//
	//	Encode colors and print message, resetting attributes on term.
	//
	//	\x1B[1K\x1B[1000D
	//
    str = str.replace(/`/g, "\n" + (options.useLines ? (options.useLines++ + "\t ") : ""));

    //	Always add a terminating tail to the string.
    //
    str += attCode("reset");

	//	Will return terminal code producing foreground color reqested.
	//
	//	@param		{String}	c		A key present in #fgcolors map.
	//
	function fgCode(c) {
		return (c in fgcolors) ? '\x1B[' + fgcolors[c] + 'm' : "";
	}

	//	Will return terminal code producing background color reqested.
	//
	//	@param		{String}	c		A key present in #bgcolors map.
	//
	function bgCode(c) {
		return (c in bgcolors) ? '\x1B[' + bgcolors[c] + 'm' : "";
	}

	//	Will return terminal code setting attribute reqested.
	//
	//	@param		{String}	a		A key present in #attributes map.
	//
	function attCode(a) {
		return (a in attributes) ? '\x1B[' + attributes[a] + 'm' : "";
	}

    util.error(str.trim());
};

//	Receive and implement process boot commands.
//
var parse = function() {

	var args 	= process.argv.slice(2);
	var map		= [];

	args.forEach(function(arg) {
		arg	= arg.split("=");

		map.push({
			command	: (arg[0] || "").trim(),
			value	: (arg[1] || "").trim()
		});
	});

	return map;
};


clio.set = function(o) {
    options.useLines	= o.useLines === void 0 ? false : !!o.useLines;
    options.defaultFg	= o.defaultFg 	|| false;
    options.defaultBg	= o.defaultBg 	|| false;
    options.defaultAtt	= o.defaultAtt 	|| false;
}

clio.print  = print;
clio.parse  = parse;

}()); 

