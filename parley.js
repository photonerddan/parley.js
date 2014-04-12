(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){

},{}],2:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var Handlebars = require("./handlebars.runtime")["default"];

// Compiler imports
var AST = require("./handlebars/compiler/ast")["default"];
var Parser = require("./handlebars/compiler/base").parser;
var parse = require("./handlebars/compiler/base").parse;
var Compiler = require("./handlebars/compiler/compiler").Compiler;
var compile = require("./handlebars/compiler/compiler").compile;
var precompile = require("./handlebars/compiler/compiler").precompile;
var JavaScriptCompiler = require("./handlebars/compiler/javascript-compiler")["default"];

var _create = Handlebars.create;
var create = function() {
  var hb = _create();

  hb.compile = function(input, options) {
    return compile(input, options, hb);
  };
  hb.precompile = function (input, options) {
    return precompile(input, options, hb);
  };

  hb.AST = AST;
  hb.Compiler = Compiler;
  hb.JavaScriptCompiler = JavaScriptCompiler;
  hb.Parser = Parser;
  hb.parse = parse;

  return hb;
};

Handlebars = create();
Handlebars.create = create;

exports["default"] = Handlebars;
},{"./handlebars.runtime":3,"./handlebars/compiler/ast":5,"./handlebars/compiler/base":6,"./handlebars/compiler/compiler":7,"./handlebars/compiler/javascript-compiler":8}],3:[function(require,module,exports){
"use strict";
/*globals Handlebars: true */
var base = require("./handlebars/base");

// Each of these augment the Handlebars object. No need to setup here.
// (This is done to easily share code between commonjs and browse envs)
var SafeString = require("./handlebars/safe-string")["default"];
var Exception = require("./handlebars/exception")["default"];
var Utils = require("./handlebars/utils");
var runtime = require("./handlebars/runtime");

// For compatibility and usage outside of module systems, make the Handlebars object a namespace
var create = function() {
  var hb = new base.HandlebarsEnvironment();

  Utils.extend(hb, base);
  hb.SafeString = SafeString;
  hb.Exception = Exception;
  hb.Utils = Utils;

  hb.VM = runtime;
  hb.template = function(spec) {
    return runtime.template(spec, hb);
  };

  return hb;
};

var Handlebars = create();
Handlebars.create = create;

exports["default"] = Handlebars;
},{"./handlebars/base":4,"./handlebars/exception":12,"./handlebars/runtime":13,"./handlebars/safe-string":14,"./handlebars/utils":15}],4:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];

var VERSION = "1.3.0";
exports.VERSION = VERSION;var COMPILER_REVISION = 4;
exports.COMPILER_REVISION = COMPILER_REVISION;
var REVISION_CHANGES = {
  1: '<= 1.0.rc.2', // 1.0.rc.2 is actually rev2 but doesn't report it
  2: '== 1.0.0-rc.3',
  3: '== 1.0.0-rc.4',
  4: '>= 1.0.0'
};
exports.REVISION_CHANGES = REVISION_CHANGES;
var isArray = Utils.isArray,
    isFunction = Utils.isFunction,
    toString = Utils.toString,
    objectType = '[object Object]';

function HandlebarsEnvironment(helpers, partials) {
  this.helpers = helpers || {};
  this.partials = partials || {};

  registerDefaultHelpers(this);
}

exports.HandlebarsEnvironment = HandlebarsEnvironment;HandlebarsEnvironment.prototype = {
  constructor: HandlebarsEnvironment,

  logger: logger,
  log: log,

  registerHelper: function(name, fn, inverse) {
    if (toString.call(name) === objectType) {
      if (inverse || fn) { throw new Exception('Arg not supported with multiple helpers'); }
      Utils.extend(this.helpers, name);
    } else {
      if (inverse) { fn.not = inverse; }
      this.helpers[name] = fn;
    }
  },

  registerPartial: function(name, str) {
    if (toString.call(name) === objectType) {
      Utils.extend(this.partials,  name);
    } else {
      this.partials[name] = str;
    }
  }
};

function registerDefaultHelpers(instance) {
  instance.registerHelper('helperMissing', function(arg) {
    if(arguments.length === 2) {
      return undefined;
    } else {
      throw new Exception("Missing helper: '" + arg + "'");
    }
  });

  instance.registerHelper('blockHelperMissing', function(context, options) {
    var inverse = options.inverse || function() {}, fn = options.fn;

    if (isFunction(context)) { context = context.call(this); }

    if(context === true) {
      return fn(this);
    } else if(context === false || context == null) {
      return inverse(this);
    } else if (isArray(context)) {
      if(context.length > 0) {
        return instance.helpers.each(context, options);
      } else {
        return inverse(this);
      }
    } else {
      return fn(context);
    }
  });

  instance.registerHelper('each', function(context, options) {
    var fn = options.fn, inverse = options.inverse;
    var i = 0, ret = "", data;

    if (isFunction(context)) { context = context.call(this); }

    if (options.data) {
      data = createFrame(options.data);
    }

    if(context && typeof context === 'object') {
      if (isArray(context)) {
        for(var j = context.length; i<j; i++) {
          if (data) {
            data.index = i;
            data.first = (i === 0);
            data.last  = (i === (context.length-1));
          }
          ret = ret + fn(context[i], { data: data });
        }
      } else {
        for(var key in context) {
          if(context.hasOwnProperty(key)) {
            if(data) { 
              data.key = key; 
              data.index = i;
              data.first = (i === 0);
            }
            ret = ret + fn(context[key], {data: data});
            i++;
          }
        }
      }
    }

    if(i === 0){
      ret = inverse(this);
    }

    return ret;
  });

  instance.registerHelper('if', function(conditional, options) {
    if (isFunction(conditional)) { conditional = conditional.call(this); }

    // Default behavior is to render the positive path if the value is truthy and not empty.
    // The `includeZero` option may be set to treat the condtional as purely not empty based on the
    // behavior of isEmpty. Effectively this determines if 0 is handled by the positive path or negative.
    if ((!options.hash.includeZero && !conditional) || Utils.isEmpty(conditional)) {
      return options.inverse(this);
    } else {
      return options.fn(this);
    }
  });

  instance.registerHelper('unless', function(conditional, options) {
    return instance.helpers['if'].call(this, conditional, {fn: options.inverse, inverse: options.fn, hash: options.hash});
  });

  instance.registerHelper('with', function(context, options) {
    if (isFunction(context)) { context = context.call(this); }

    if (!Utils.isEmpty(context)) return options.fn(context);
  });

  instance.registerHelper('log', function(context, options) {
    var level = options.data && options.data.level != null ? parseInt(options.data.level, 10) : 1;
    instance.log(level, context);
  });
}

var logger = {
  methodMap: { 0: 'debug', 1: 'info', 2: 'warn', 3: 'error' },

  // State enum
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  level: 3,

  // can be overridden in the host environment
  log: function(level, obj) {
    if (logger.level <= level) {
      var method = logger.methodMap[level];
      if (typeof console !== 'undefined' && console[method]) {
        console[method].call(console, obj);
      }
    }
  }
};
exports.logger = logger;
function log(level, obj) { logger.log(level, obj); }

exports.log = log;var createFrame = function(object) {
  var obj = {};
  Utils.extend(obj, object);
  return obj;
};
exports.createFrame = createFrame;
},{"./exception":12,"./utils":15}],5:[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function LocationInfo(locInfo){
  locInfo = locInfo || {};
  this.firstLine   = locInfo.first_line;
  this.firstColumn = locInfo.first_column;
  this.lastColumn  = locInfo.last_column;
  this.lastLine    = locInfo.last_line;
}

var AST = {
  ProgramNode: function(statements, inverseStrip, inverse, locInfo) {
    var inverseLocationInfo, firstInverseNode;
    if (arguments.length === 3) {
      locInfo = inverse;
      inverse = null;
    } else if (arguments.length === 2) {
      locInfo = inverseStrip;
      inverseStrip = null;
    }

    LocationInfo.call(this, locInfo);
    this.type = "program";
    this.statements = statements;
    this.strip = {};

    if(inverse) {
      firstInverseNode = inverse[0];
      if (firstInverseNode) {
        inverseLocationInfo = {
          first_line: firstInverseNode.firstLine,
          last_line: firstInverseNode.lastLine,
          last_column: firstInverseNode.lastColumn,
          first_column: firstInverseNode.firstColumn
        };
        this.inverse = new AST.ProgramNode(inverse, inverseStrip, inverseLocationInfo);
      } else {
        this.inverse = new AST.ProgramNode(inverse, inverseStrip);
      }
      this.strip.right = inverseStrip.left;
    } else if (inverseStrip) {
      this.strip.left = inverseStrip.right;
    }
  },

  MustacheNode: function(rawParams, hash, open, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "mustache";
    this.strip = strip;

    // Open may be a string parsed from the parser or a passed boolean flag
    if (open != null && open.charAt) {
      // Must use charAt to support IE pre-10
      var escapeFlag = open.charAt(3) || open.charAt(2);
      this.escaped = escapeFlag !== '{' && escapeFlag !== '&';
    } else {
      this.escaped = !!open;
    }

    if (rawParams instanceof AST.SexprNode) {
      this.sexpr = rawParams;
    } else {
      // Support old AST API
      this.sexpr = new AST.SexprNode(rawParams, hash);
    }

    this.sexpr.isRoot = true;

    // Support old AST API that stored this info in MustacheNode
    this.id = this.sexpr.id;
    this.params = this.sexpr.params;
    this.hash = this.sexpr.hash;
    this.eligibleHelper = this.sexpr.eligibleHelper;
    this.isHelper = this.sexpr.isHelper;
  },

  SexprNode: function(rawParams, hash, locInfo) {
    LocationInfo.call(this, locInfo);

    this.type = "sexpr";
    this.hash = hash;

    var id = this.id = rawParams[0];
    var params = this.params = rawParams.slice(1);

    // a mustache is an eligible helper if:
    // * its id is simple (a single part, not `this` or `..`)
    var eligibleHelper = this.eligibleHelper = id.isSimple;

    // a mustache is definitely a helper if:
    // * it is an eligible helper, and
    // * it has at least one parameter or hash segment
    this.isHelper = eligibleHelper && (params.length || hash);

    // if a mustache is an eligible helper but not a definite
    // helper, it is ambiguous, and will be resolved in a later
    // pass or at runtime.
  },

  PartialNode: function(partialName, context, strip, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type         = "partial";
    this.partialName  = partialName;
    this.context      = context;
    this.strip = strip;
  },

  BlockNode: function(mustache, program, inverse, close, locInfo) {
    LocationInfo.call(this, locInfo);

    if(mustache.sexpr.id.original !== close.path.original) {
      throw new Exception(mustache.sexpr.id.original + " doesn't match " + close.path.original, this);
    }

    this.type = 'block';
    this.mustache = mustache;
    this.program  = program;
    this.inverse  = inverse;

    this.strip = {
      left: mustache.strip.left,
      right: close.strip.right
    };

    (program || inverse).strip.left = mustache.strip.right;
    (inverse || program).strip.right = close.strip.left;

    if (inverse && !program) {
      this.isInverse = true;
    }
  },

  ContentNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "content";
    this.string = string;
  },

  HashNode: function(pairs, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "hash";
    this.pairs = pairs;
  },

  IdNode: function(parts, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "ID";

    var original = "",
        dig = [],
        depth = 0;

    for(var i=0,l=parts.length; i<l; i++) {
      var part = parts[i].part;
      original += (parts[i].separator || '') + part;

      if (part === ".." || part === "." || part === "this") {
        if (dig.length > 0) {
          throw new Exception("Invalid path: " + original, this);
        } else if (part === "..") {
          depth++;
        } else {
          this.isScoped = true;
        }
      } else {
        dig.push(part);
      }
    }

    this.original = original;
    this.parts    = dig;
    this.string   = dig.join('.');
    this.depth    = depth;

    // an ID is simple if it only has one part, and that part is not
    // `..` or `this`.
    this.isSimple = parts.length === 1 && !this.isScoped && depth === 0;

    this.stringModeValue = this.string;
  },

  PartialNameNode: function(name, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "PARTIAL_NAME";
    this.name = name.original;
  },

  DataNode: function(id, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "DATA";
    this.id = id;
  },

  StringNode: function(string, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "STRING";
    this.original =
      this.string =
      this.stringModeValue = string;
  },

  IntegerNode: function(integer, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "INTEGER";
    this.original =
      this.integer = integer;
    this.stringModeValue = Number(integer);
  },

  BooleanNode: function(bool, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "BOOLEAN";
    this.bool = bool;
    this.stringModeValue = bool === "true";
  },

  CommentNode: function(comment, locInfo) {
    LocationInfo.call(this, locInfo);
    this.type = "comment";
    this.comment = comment;
  }
};

// Must be exported as an object rather than the root of the module as the jison lexer
// most modify the object to operate properly.
exports["default"] = AST;
},{"../exception":12}],6:[function(require,module,exports){
"use strict";
var parser = require("./parser")["default"];
var AST = require("./ast")["default"];

exports.parser = parser;

function parse(input) {
  // Just return if an already-compile AST was passed in.
  if(input.constructor === AST.ProgramNode) { return input; }

  parser.yy = AST;
  return parser.parse(input);
}

exports.parse = parse;
},{"./ast":5,"./parser":9}],7:[function(require,module,exports){
"use strict";
var Exception = require("../exception")["default"];

function Compiler() {}

exports.Compiler = Compiler;// the foundHelper register will disambiguate helper lookup from finding a
// function in a context. This is necessary for mustache compatibility, which
// requires that context functions in blocks are evaluated by blockHelperMissing,
// and then proceed as if the resulting value was provided to blockHelperMissing.

Compiler.prototype = {
  compiler: Compiler,

  disassemble: function() {
    var opcodes = this.opcodes, opcode, out = [], params, param;

    for (var i=0, l=opcodes.length; i<l; i++) {
      opcode = opcodes[i];

      if (opcode.opcode === 'DECLARE') {
        out.push("DECLARE " + opcode.name + "=" + opcode.value);
      } else {
        params = [];
        for (var j=0; j<opcode.args.length; j++) {
          param = opcode.args[j];
          if (typeof param === "string") {
            param = "\"" + param.replace("\n", "\\n") + "\"";
          }
          params.push(param);
        }
        out.push(opcode.opcode + " " + params.join(" "));
      }
    }

    return out.join("\n");
  },

  equals: function(other) {
    var len = this.opcodes.length;
    if (other.opcodes.length !== len) {
      return false;
    }

    for (var i = 0; i < len; i++) {
      var opcode = this.opcodes[i],
          otherOpcode = other.opcodes[i];
      if (opcode.opcode !== otherOpcode.opcode || opcode.args.length !== otherOpcode.args.length) {
        return false;
      }
      for (var j = 0; j < opcode.args.length; j++) {
        if (opcode.args[j] !== otherOpcode.args[j]) {
          return false;
        }
      }
    }

    len = this.children.length;
    if (other.children.length !== len) {
      return false;
    }
    for (i = 0; i < len; i++) {
      if (!this.children[i].equals(other.children[i])) {
        return false;
      }
    }

    return true;
  },

  guid: 0,

  compile: function(program, options) {
    this.opcodes = [];
    this.children = [];
    this.depths = {list: []};
    this.options = options;

    // These changes will propagate to the other compiler components
    var knownHelpers = this.options.knownHelpers;
    this.options.knownHelpers = {
      'helperMissing': true,
      'blockHelperMissing': true,
      'each': true,
      'if': true,
      'unless': true,
      'with': true,
      'log': true
    };
    if (knownHelpers) {
      for (var name in knownHelpers) {
        this.options.knownHelpers[name] = knownHelpers[name];
      }
    }

    return this.accept(program);
  },

  accept: function(node) {
    var strip = node.strip || {},
        ret;
    if (strip.left) {
      this.opcode('strip');
    }

    ret = this[node.type](node);

    if (strip.right) {
      this.opcode('strip');
    }

    return ret;
  },

  program: function(program) {
    var statements = program.statements;

    for(var i=0, l=statements.length; i<l; i++) {
      this.accept(statements[i]);
    }
    this.isSimple = l === 1;

    this.depths.list = this.depths.list.sort(function(a, b) {
      return a - b;
    });

    return this;
  },

  compileProgram: function(program) {
    var result = new this.compiler().compile(program, this.options);
    var guid = this.guid++, depth;

    this.usePartial = this.usePartial || result.usePartial;

    this.children[guid] = result;

    for(var i=0, l=result.depths.list.length; i<l; i++) {
      depth = result.depths.list[i];

      if(depth < 2) { continue; }
      else { this.addDepth(depth - 1); }
    }

    return guid;
  },

  block: function(block) {
    var mustache = block.mustache,
        program = block.program,
        inverse = block.inverse;

    if (program) {
      program = this.compileProgram(program);
    }

    if (inverse) {
      inverse = this.compileProgram(inverse);
    }

    var sexpr = mustache.sexpr;
    var type = this.classifySexpr(sexpr);

    if (type === "helper") {
      this.helperSexpr(sexpr, program, inverse);
    } else if (type === "simple") {
      this.simpleSexpr(sexpr);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('blockValue');
    } else {
      this.ambiguousSexpr(sexpr, program, inverse);

      // now that the simple mustache is resolved, we need to
      // evaluate it by executing `blockHelperMissing`
      this.opcode('pushProgram', program);
      this.opcode('pushProgram', inverse);
      this.opcode('emptyHash');
      this.opcode('ambiguousBlockValue');
    }

    this.opcode('append');
  },

  hash: function(hash) {
    var pairs = hash.pairs, pair, val;

    this.opcode('pushHash');

    for(var i=0, l=pairs.length; i<l; i++) {
      pair = pairs[i];
      val  = pair[1];

      if (this.options.stringParams) {
        if(val.depth) {
          this.addDepth(val.depth);
        }
        this.opcode('getContext', val.depth || 0);
        this.opcode('pushStringParam', val.stringModeValue, val.type);

        if (val.type === 'sexpr') {
          // Subexpressions get evaluated and passed in
          // in string params mode.
          this.sexpr(val);
        }
      } else {
        this.accept(val);
      }

      this.opcode('assignToHash', pair[0]);
    }
    this.opcode('popHash');
  },

  partial: function(partial) {
    var partialName = partial.partialName;
    this.usePartial = true;

    if(partial.context) {
      this.ID(partial.context);
    } else {
      this.opcode('push', 'depth0');
    }

    this.opcode('invokePartial', partialName.name);
    this.opcode('append');
  },

  content: function(content) {
    this.opcode('appendContent', content.string);
  },

  mustache: function(mustache) {
    this.sexpr(mustache.sexpr);

    if(mustache.escaped && !this.options.noEscape) {
      this.opcode('appendEscaped');
    } else {
      this.opcode('append');
    }
  },

  ambiguousSexpr: function(sexpr, program, inverse) {
    var id = sexpr.id,
        name = id.parts[0],
        isBlock = program != null || inverse != null;

    this.opcode('getContext', id.depth);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    this.opcode('invokeAmbiguous', name, isBlock);
  },

  simpleSexpr: function(sexpr) {
    var id = sexpr.id;

    if (id.type === 'DATA') {
      this.DATA(id);
    } else if (id.parts.length) {
      this.ID(id);
    } else {
      // Simplified ID for `this`
      this.addDepth(id.depth);
      this.opcode('getContext', id.depth);
      this.opcode('pushContext');
    }

    this.opcode('resolvePossibleLambda');
  },

  helperSexpr: function(sexpr, program, inverse) {
    var params = this.setupFullMustacheParams(sexpr, program, inverse),
        name = sexpr.id.parts[0];

    if (this.options.knownHelpers[name]) {
      this.opcode('invokeKnownHelper', params.length, name);
    } else if (this.options.knownHelpersOnly) {
      throw new Exception("You specified knownHelpersOnly, but used the unknown helper " + name, sexpr);
    } else {
      this.opcode('invokeHelper', params.length, name, sexpr.isRoot);
    }
  },

  sexpr: function(sexpr) {
    var type = this.classifySexpr(sexpr);

    if (type === "simple") {
      this.simpleSexpr(sexpr);
    } else if (type === "helper") {
      this.helperSexpr(sexpr);
    } else {
      this.ambiguousSexpr(sexpr);
    }
  },

  ID: function(id) {
    this.addDepth(id.depth);
    this.opcode('getContext', id.depth);

    var name = id.parts[0];
    if (!name) {
      this.opcode('pushContext');
    } else {
      this.opcode('lookupOnContext', id.parts[0]);
    }

    for(var i=1, l=id.parts.length; i<l; i++) {
      this.opcode('lookup', id.parts[i]);
    }
  },

  DATA: function(data) {
    this.options.data = true;
    if (data.id.isScoped || data.id.depth) {
      throw new Exception('Scoped data references are not supported: ' + data.original, data);
    }

    this.opcode('lookupData');
    var parts = data.id.parts;
    for(var i=0, l=parts.length; i<l; i++) {
      this.opcode('lookup', parts[i]);
    }
  },

  STRING: function(string) {
    this.opcode('pushString', string.string);
  },

  INTEGER: function(integer) {
    this.opcode('pushLiteral', integer.integer);
  },

  BOOLEAN: function(bool) {
    this.opcode('pushLiteral', bool.bool);
  },

  comment: function() {},

  // HELPERS
  opcode: function(name) {
    this.opcodes.push({ opcode: name, args: [].slice.call(arguments, 1) });
  },

  declare: function(name, value) {
    this.opcodes.push({ opcode: 'DECLARE', name: name, value: value });
  },

  addDepth: function(depth) {
    if(depth === 0) { return; }

    if(!this.depths[depth]) {
      this.depths[depth] = true;
      this.depths.list.push(depth);
    }
  },

  classifySexpr: function(sexpr) {
    var isHelper   = sexpr.isHelper;
    var isEligible = sexpr.eligibleHelper;
    var options    = this.options;

    // if ambiguous, we can possibly resolve the ambiguity now
    if (isEligible && !isHelper) {
      var name = sexpr.id.parts[0];

      if (options.knownHelpers[name]) {
        isHelper = true;
      } else if (options.knownHelpersOnly) {
        isEligible = false;
      }
    }

    if (isHelper) { return "helper"; }
    else if (isEligible) { return "ambiguous"; }
    else { return "simple"; }
  },

  pushParams: function(params) {
    var i = params.length, param;

    while(i--) {
      param = params[i];

      if(this.options.stringParams) {
        if(param.depth) {
          this.addDepth(param.depth);
        }

        this.opcode('getContext', param.depth || 0);
        this.opcode('pushStringParam', param.stringModeValue, param.type);

        if (param.type === 'sexpr') {
          // Subexpressions get evaluated and passed in
          // in string params mode.
          this.sexpr(param);
        }
      } else {
        this[param.type](param);
      }
    }
  },

  setupFullMustacheParams: function(sexpr, program, inverse) {
    var params = sexpr.params;
    this.pushParams(params);

    this.opcode('pushProgram', program);
    this.opcode('pushProgram', inverse);

    if (sexpr.hash) {
      this.hash(sexpr.hash);
    } else {
      this.opcode('emptyHash');
    }

    return params;
  }
};

function precompile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.precompile. You passed " + input);
  }

  options = options || {};
  if (!('data' in options)) {
    options.data = true;
  }

  var ast = env.parse(input);
  var environment = new env.Compiler().compile(ast, options);
  return new env.JavaScriptCompiler().compile(environment, options);
}

exports.precompile = precompile;function compile(input, options, env) {
  if (input == null || (typeof input !== 'string' && input.constructor !== env.AST.ProgramNode)) {
    throw new Exception("You must pass a string or Handlebars AST to Handlebars.compile. You passed " + input);
  }

  options = options || {};

  if (!('data' in options)) {
    options.data = true;
  }

  var compiled;

  function compileInput() {
    var ast = env.parse(input);
    var environment = new env.Compiler().compile(ast, options);
    var templateSpec = new env.JavaScriptCompiler().compile(environment, options, undefined, true);
    return env.template(templateSpec);
  }

  // Template is only compiled on first use and cached after that point.
  return function(context, options) {
    if (!compiled) {
      compiled = compileInput();
    }
    return compiled.call(this, context, options);
  };
}

exports.compile = compile;
},{"../exception":12}],8:[function(require,module,exports){
"use strict";
var COMPILER_REVISION = require("../base").COMPILER_REVISION;
var REVISION_CHANGES = require("../base").REVISION_CHANGES;
var log = require("../base").log;
var Exception = require("../exception")["default"];

function Literal(value) {
  this.value = value;
}

function JavaScriptCompiler() {}

JavaScriptCompiler.prototype = {
  // PUBLIC API: You can override these methods in a subclass to provide
  // alternative compiled forms for name lookup and buffering semantics
  nameLookup: function(parent, name /* , type*/) {
    var wrap,
        ret;
    if (parent.indexOf('depth') === 0) {
      wrap = true;
    }

    if (/^[0-9]+$/.test(name)) {
      ret = parent + "[" + name + "]";
    } else if (JavaScriptCompiler.isValidJavaScriptVariableName(name)) {
      ret = parent + "." + name;
    }
    else {
      ret = parent + "['" + name + "']";
    }

    if (wrap) {
      return '(' + parent + ' && ' + ret + ')';
    } else {
      return ret;
    }
  },

  compilerInfo: function() {
    var revision = COMPILER_REVISION,
        versions = REVISION_CHANGES[revision];
    return "this.compilerInfo = ["+revision+",'"+versions+"'];\n";
  },

  appendToBuffer: function(string) {
    if (this.environment.isSimple) {
      return "return " + string + ";";
    } else {
      return {
        appendToBuffer: true,
        content: string,
        toString: function() { return "buffer += " + string + ";"; }
      };
    }
  },

  initializeBuffer: function() {
    return this.quotedString("");
  },

  namespace: "Handlebars",
  // END PUBLIC API

  compile: function(environment, options, context, asObject) {
    this.environment = environment;
    this.options = options || {};

    log('debug', this.environment.disassemble() + "\n\n");

    this.name = this.environment.name;
    this.isChild = !!context;
    this.context = context || {
      programs: [],
      environments: [],
      aliases: { }
    };

    this.preamble();

    this.stackSlot = 0;
    this.stackVars = [];
    this.registers = { list: [] };
    this.hashes = [];
    this.compileStack = [];
    this.inlineStack = [];

    this.compileChildren(environment, options);

    var opcodes = environment.opcodes, opcode;

    this.i = 0;

    for(var l=opcodes.length; this.i<l; this.i++) {
      opcode = opcodes[this.i];

      if(opcode.opcode === 'DECLARE') {
        this[opcode.name] = opcode.value;
      } else {
        this[opcode.opcode].apply(this, opcode.args);
      }

      // Reset the stripNext flag if it was not set by this operation.
      if (opcode.opcode !== this.stripNext) {
        this.stripNext = false;
      }
    }

    // Flush any trailing content that might be pending.
    this.pushSource('');

    if (this.stackSlot || this.inlineStack.length || this.compileStack.length) {
      throw new Exception('Compile completed with content left on stack');
    }

    return this.createFunctionContext(asObject);
  },

  preamble: function() {
    var out = [];

    if (!this.isChild) {
      var namespace = this.namespace;

      var copies = "helpers = this.merge(helpers, " + namespace + ".helpers);";
      if (this.environment.usePartial) { copies = copies + " partials = this.merge(partials, " + namespace + ".partials);"; }
      if (this.options.data) { copies = copies + " data = data || {};"; }
      out.push(copies);
    } else {
      out.push('');
    }

    if (!this.environment.isSimple) {
      out.push(", buffer = " + this.initializeBuffer());
    } else {
      out.push("");
    }

    // track the last context pushed into place to allow skipping the
    // getContext opcode when it would be a noop
    this.lastContext = 0;
    this.source = out;
  },

  createFunctionContext: function(asObject) {
    var locals = this.stackVars.concat(this.registers.list);

    if(locals.length > 0) {
      this.source[1] = this.source[1] + ", " + locals.join(", ");
    }

    // Generate minimizer alias mappings
    if (!this.isChild) {
      for (var alias in this.context.aliases) {
        if (this.context.aliases.hasOwnProperty(alias)) {
          this.source[1] = this.source[1] + ', ' + alias + '=' + this.context.aliases[alias];
        }
      }
    }

    if (this.source[1]) {
      this.source[1] = "var " + this.source[1].substring(2) + ";";
    }

    // Merge children
    if (!this.isChild) {
      this.source[1] += '\n' + this.context.programs.join('\n') + '\n';
    }

    if (!this.environment.isSimple) {
      this.pushSource("return buffer;");
    }

    var params = this.isChild ? ["depth0", "data"] : ["Handlebars", "depth0", "helpers", "partials", "data"];

    for(var i=0, l=this.environment.depths.list.length; i<l; i++) {
      params.push("depth" + this.environment.depths.list[i]);
    }

    // Perform a second pass over the output to merge content when possible
    var source = this.mergeSource();

    if (!this.isChild) {
      source = this.compilerInfo()+source;
    }

    if (asObject) {
      params.push(source);

      return Function.apply(this, params);
    } else {
      var functionSource = 'function ' + (this.name || '') + '(' + params.join(',') + ') {\n  ' + source + '}';
      log('debug', functionSource + "\n\n");
      return functionSource;
    }
  },
  mergeSource: function() {
    // WARN: We are not handling the case where buffer is still populated as the source should
    // not have buffer append operations as their final action.
    var source = '',
        buffer;
    for (var i = 0, len = this.source.length; i < len; i++) {
      var line = this.source[i];
      if (line.appendToBuffer) {
        if (buffer) {
          buffer = buffer + '\n    + ' + line.content;
        } else {
          buffer = line.content;
        }
      } else {
        if (buffer) {
          source += 'buffer += ' + buffer + ';\n  ';
          buffer = undefined;
        }
        source += line + '\n  ';
      }
    }
    return source;
  },

  // [blockValue]
  //
  // On stack, before: hash, inverse, program, value
  // On stack, after: return value of blockHelperMissing
  //
  // The purpose of this opcode is to take a block of the form
  // `{{#foo}}...{{/foo}}`, resolve the value of `foo`, and
  // replace it on the stack with the result of properly
  // invoking blockHelperMissing.
  blockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    this.replaceStack(function(current) {
      params.splice(1, 0, current);
      return "blockHelperMissing.call(" + params.join(", ") + ")";
    });
  },

  // [ambiguousBlockValue]
  //
  // On stack, before: hash, inverse, program, value
  // Compiler value, before: lastHelper=value of last found helper, if any
  // On stack, after, if no lastHelper: same as [blockValue]
  // On stack, after, if lastHelper: value
  ambiguousBlockValue: function() {
    this.context.aliases.blockHelperMissing = 'helpers.blockHelperMissing';

    var params = ["depth0"];
    this.setupParams(0, params);

    var current = this.topStack();
    params.splice(1, 0, current);

    this.pushSource("if (!" + this.lastHelper + ") { " + current + " = blockHelperMissing.call(" + params.join(", ") + "); }");
  },

  // [appendContent]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Appends the string value of `content` to the current buffer
  appendContent: function(content) {
    if (this.pendingContent) {
      content = this.pendingContent + content;
    }
    if (this.stripNext) {
      content = content.replace(/^\s+/, '');
    }

    this.pendingContent = content;
  },

  // [strip]
  //
  // On stack, before: ...
  // On stack, after: ...
  //
  // Removes any trailing whitespace from the prior content node and flags
  // the next operation for stripping if it is a content node.
  strip: function() {
    if (this.pendingContent) {
      this.pendingContent = this.pendingContent.replace(/\s+$/, '');
    }
    this.stripNext = 'strip';
  },

  // [append]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Coerces `value` to a String and appends it to the current buffer.
  //
  // If `value` is truthy, or 0, it is coerced into a string and appended
  // Otherwise, the empty string is appended
  append: function() {
    // Force anything that is inlined onto the stack so we don't have duplication
    // when we examine local
    this.flushInline();
    var local = this.popStack();
    this.pushSource("if(" + local + " || " + local + " === 0) { " + this.appendToBuffer(local) + " }");
    if (this.environment.isSimple) {
      this.pushSource("else { " + this.appendToBuffer("''") + " }");
    }
  },

  // [appendEscaped]
  //
  // On stack, before: value, ...
  // On stack, after: ...
  //
  // Escape `value` and append it to the buffer
  appendEscaped: function() {
    this.context.aliases.escapeExpression = 'this.escapeExpression';

    this.pushSource(this.appendToBuffer("escapeExpression(" + this.popStack() + ")"));
  },

  // [getContext]
  //
  // On stack, before: ...
  // On stack, after: ...
  // Compiler value, after: lastContext=depth
  //
  // Set the value of the `lastContext` compiler value to the depth
  getContext: function(depth) {
    if(this.lastContext !== depth) {
      this.lastContext = depth;
    }
  },

  // [lookupOnContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext[name], ...
  //
  // Looks up the value of `name` on the current context and pushes
  // it onto the stack.
  lookupOnContext: function(name) {
    this.push(this.nameLookup('depth' + this.lastContext, name, 'context'));
  },

  // [pushContext]
  //
  // On stack, before: ...
  // On stack, after: currentContext, ...
  //
  // Pushes the value of the current context onto the stack.
  pushContext: function() {
    this.pushStackLiteral('depth' + this.lastContext);
  },

  // [resolvePossibleLambda]
  //
  // On stack, before: value, ...
  // On stack, after: resolved value, ...
  //
  // If the `value` is a lambda, replace it on the stack by
  // the return value of the lambda
  resolvePossibleLambda: function() {
    this.context.aliases.functionType = '"function"';

    this.replaceStack(function(current) {
      return "typeof " + current + " === functionType ? " + current + ".apply(depth0) : " + current;
    });
  },

  // [lookup]
  //
  // On stack, before: value, ...
  // On stack, after: value[name], ...
  //
  // Replace the value on the stack with the result of looking
  // up `name` on `value`
  lookup: function(name) {
    this.replaceStack(function(current) {
      return current + " == null || " + current + " === false ? " + current + " : " + this.nameLookup(current, name, 'context');
    });
  },

  // [lookupData]
  //
  // On stack, before: ...
  // On stack, after: data, ...
  //
  // Push the data lookup operator
  lookupData: function() {
    this.pushStackLiteral('data');
  },

  // [pushStringParam]
  //
  // On stack, before: ...
  // On stack, after: string, currentContext, ...
  //
  // This opcode is designed for use in string mode, which
  // provides the string value of a parameter along with its
  // depth rather than resolving it immediately.
  pushStringParam: function(string, type) {
    this.pushStackLiteral('depth' + this.lastContext);

    this.pushString(type);

    // If it's a subexpression, the string result
    // will be pushed after this opcode.
    if (type !== 'sexpr') {
      if (typeof string === 'string') {
        this.pushString(string);
      } else {
        this.pushStackLiteral(string);
      }
    }
  },

  emptyHash: function() {
    this.pushStackLiteral('{}');

    if (this.options.stringParams) {
      this.push('{}'); // hashContexts
      this.push('{}'); // hashTypes
    }
  },
  pushHash: function() {
    if (this.hash) {
      this.hashes.push(this.hash);
    }
    this.hash = {values: [], types: [], contexts: []};
  },
  popHash: function() {
    var hash = this.hash;
    this.hash = this.hashes.pop();

    if (this.options.stringParams) {
      this.push('{' + hash.contexts.join(',') + '}');
      this.push('{' + hash.types.join(',') + '}');
    }

    this.push('{\n    ' + hash.values.join(',\n    ') + '\n  }');
  },

  // [pushString]
  //
  // On stack, before: ...
  // On stack, after: quotedString(string), ...
  //
  // Push a quoted version of `string` onto the stack
  pushString: function(string) {
    this.pushStackLiteral(this.quotedString(string));
  },

  // [push]
  //
  // On stack, before: ...
  // On stack, after: expr, ...
  //
  // Push an expression onto the stack
  push: function(expr) {
    this.inlineStack.push(expr);
    return expr;
  },

  // [pushLiteral]
  //
  // On stack, before: ...
  // On stack, after: value, ...
  //
  // Pushes a value onto the stack. This operation prevents
  // the compiler from creating a temporary variable to hold
  // it.
  pushLiteral: function(value) {
    this.pushStackLiteral(value);
  },

  // [pushProgram]
  //
  // On stack, before: ...
  // On stack, after: program(guid), ...
  //
  // Push a program expression onto the stack. This takes
  // a compile-time guid and converts it into a runtime-accessible
  // expression.
  pushProgram: function(guid) {
    if (guid != null) {
      this.pushStackLiteral(this.programExpression(guid));
    } else {
      this.pushStackLiteral(null);
    }
  },

  // [invokeHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // Pops off the helper's parameters, invokes the helper,
  // and pushes the helper's return value onto the stack.
  //
  // If the helper is not found, `helperMissing` is called.
  invokeHelper: function(paramSize, name, isRoot) {
    this.context.aliases.helperMissing = 'helpers.helperMissing';
    this.useRegister('helper');

    var helper = this.lastHelper = this.setupHelper(paramSize, name, true);
    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');

    var lookup = 'helper = ' + helper.name + ' || ' + nonHelper;
    if (helper.paramsInit) {
      lookup += ',' + helper.paramsInit;
    }

    this.push(
      '('
        + lookup
        + ',helper '
          + '? helper.call(' + helper.callParams + ') '
          + ': helperMissing.call(' + helper.helperMissingParams + '))');

    // Always flush subexpressions. This is both to prevent the compounding size issue that
    // occurs when the code has to be duplicated for inlining and also to prevent errors
    // due to the incorrect options object being passed due to the shared register.
    if (!isRoot) {
      this.flushInline();
    }
  },

  // [invokeKnownHelper]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of helper invocation
  //
  // This operation is used when the helper is known to exist,
  // so a `helperMissing` fallback is not required.
  invokeKnownHelper: function(paramSize, name) {
    var helper = this.setupHelper(paramSize, name);
    this.push(helper.name + ".call(" + helper.callParams + ")");
  },

  // [invokeAmbiguous]
  //
  // On stack, before: hash, inverse, program, params..., ...
  // On stack, after: result of disambiguation
  //
  // This operation is used when an expression like `{{foo}}`
  // is provided, but we don't know at compile-time whether it
  // is a helper or a path.
  //
  // This operation emits more code than the other options,
  // and can be avoided by passing the `knownHelpers` and
  // `knownHelpersOnly` flags at compile-time.
  invokeAmbiguous: function(name, helperCall) {
    this.context.aliases.functionType = '"function"';
    this.useRegister('helper');

    this.emptyHash();
    var helper = this.setupHelper(0, name, helperCall);

    var helperName = this.lastHelper = this.nameLookup('helpers', name, 'helper');

    var nonHelper = this.nameLookup('depth' + this.lastContext, name, 'context');
    var nextStack = this.nextStack();

    if (helper.paramsInit) {
      this.pushSource(helper.paramsInit);
    }
    this.pushSource('if (helper = ' + helperName + ') { ' + nextStack + ' = helper.call(' + helper.callParams + '); }');
    this.pushSource('else { helper = ' + nonHelper + '; ' + nextStack + ' = typeof helper === functionType ? helper.call(' + helper.callParams + ') : helper; }');
  },

  // [invokePartial]
  //
  // On stack, before: context, ...
  // On stack after: result of partial invocation
  //
  // This operation pops off a context, invokes a partial with that context,
  // and pushes the result of the invocation back.
  invokePartial: function(name) {
    var params = [this.nameLookup('partials', name, 'partial'), "'" + name + "'", this.popStack(), "helpers", "partials"];

    if (this.options.data) {
      params.push("data");
    }

    this.context.aliases.self = "this";
    this.push("self.invokePartial(" + params.join(", ") + ")");
  },

  // [assignToHash]
  //
  // On stack, before: value, hash, ...
  // On stack, after: hash, ...
  //
  // Pops a value and hash off the stack, assigns `hash[key] = value`
  // and pushes the hash back onto the stack.
  assignToHash: function(key) {
    var value = this.popStack(),
        context,
        type;

    if (this.options.stringParams) {
      type = this.popStack();
      context = this.popStack();
    }

    var hash = this.hash;
    if (context) {
      hash.contexts.push("'" + key + "': " + context);
    }
    if (type) {
      hash.types.push("'" + key + "': " + type);
    }
    hash.values.push("'" + key + "': (" + value + ")");
  },

  // HELPERS

  compiler: JavaScriptCompiler,

  compileChildren: function(environment, options) {
    var children = environment.children, child, compiler;

    for(var i=0, l=children.length; i<l; i++) {
      child = children[i];
      compiler = new this.compiler();

      var index = this.matchExistingProgram(child);

      if (index == null) {
        this.context.programs.push('');     // Placeholder to prevent name conflicts for nested children
        index = this.context.programs.length;
        child.index = index;
        child.name = 'program' + index;
        this.context.programs[index] = compiler.compile(child, options, this.context);
        this.context.environments[index] = child;
      } else {
        child.index = index;
        child.name = 'program' + index;
      }
    }
  },
  matchExistingProgram: function(child) {
    for (var i = 0, len = this.context.environments.length; i < len; i++) {
      var environment = this.context.environments[i];
      if (environment && environment.equals(child)) {
        return i;
      }
    }
  },

  programExpression: function(guid) {
    this.context.aliases.self = "this";

    if(guid == null) {
      return "self.noop";
    }

    var child = this.environment.children[guid],
        depths = child.depths.list, depth;

    var programParams = [child.index, child.name, "data"];

    for(var i=0, l = depths.length; i<l; i++) {
      depth = depths[i];

      if(depth === 1) { programParams.push("depth0"); }
      else { programParams.push("depth" + (depth - 1)); }
    }

    return (depths.length === 0 ? "self.program(" : "self.programWithDepth(") + programParams.join(", ") + ")";
  },

  register: function(name, val) {
    this.useRegister(name);
    this.pushSource(name + " = " + val + ";");
  },

  useRegister: function(name) {
    if(!this.registers[name]) {
      this.registers[name] = true;
      this.registers.list.push(name);
    }
  },

  pushStackLiteral: function(item) {
    return this.push(new Literal(item));
  },

  pushSource: function(source) {
    if (this.pendingContent) {
      this.source.push(this.appendToBuffer(this.quotedString(this.pendingContent)));
      this.pendingContent = undefined;
    }

    if (source) {
      this.source.push(source);
    }
  },

  pushStack: function(item) {
    this.flushInline();

    var stack = this.incrStack();
    if (item) {
      this.pushSource(stack + " = " + item + ";");
    }
    this.compileStack.push(stack);
    return stack;
  },

  replaceStack: function(callback) {
    var prefix = '',
        inline = this.isInline(),
        stack,
        createdStack,
        usedLiteral;

    // If we are currently inline then we want to merge the inline statement into the
    // replacement statement via ','
    if (inline) {
      var top = this.popStack(true);

      if (top instanceof Literal) {
        // Literals do not need to be inlined
        stack = top.value;
        usedLiteral = true;
      } else {
        // Get or create the current stack name for use by the inline
        createdStack = !this.stackSlot;
        var name = !createdStack ? this.topStackName() : this.incrStack();

        prefix = '(' + this.push(name) + ' = ' + top + '),';
        stack = this.topStack();
      }
    } else {
      stack = this.topStack();
    }

    var item = callback.call(this, stack);

    if (inline) {
      if (!usedLiteral) {
        this.popStack();
      }
      if (createdStack) {
        this.stackSlot--;
      }
      this.push('(' + prefix + item + ')');
    } else {
      // Prevent modification of the context depth variable. Through replaceStack
      if (!/^stack/.test(stack)) {
        stack = this.nextStack();
      }

      this.pushSource(stack + " = (" + prefix + item + ");");
    }
    return stack;
  },

  nextStack: function() {
    return this.pushStack();
  },

  incrStack: function() {
    this.stackSlot++;
    if(this.stackSlot > this.stackVars.length) { this.stackVars.push("stack" + this.stackSlot); }
    return this.topStackName();
  },
  topStackName: function() {
    return "stack" + this.stackSlot;
  },
  flushInline: function() {
    var inlineStack = this.inlineStack;
    if (inlineStack.length) {
      this.inlineStack = [];
      for (var i = 0, len = inlineStack.length; i < len; i++) {
        var entry = inlineStack[i];
        if (entry instanceof Literal) {
          this.compileStack.push(entry);
        } else {
          this.pushStack(entry);
        }
      }
    }
  },
  isInline: function() {
    return this.inlineStack.length;
  },

  popStack: function(wrapped) {
    var inline = this.isInline(),
        item = (inline ? this.inlineStack : this.compileStack).pop();

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      if (!inline) {
        if (!this.stackSlot) {
          throw new Exception('Invalid stack pop');
        }
        this.stackSlot--;
      }
      return item;
    }
  },

  topStack: function(wrapped) {
    var stack = (this.isInline() ? this.inlineStack : this.compileStack),
        item = stack[stack.length - 1];

    if (!wrapped && (item instanceof Literal)) {
      return item.value;
    } else {
      return item;
    }
  },

  quotedString: function(str) {
    return '"' + str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u2028/g, '\\u2028')   // Per Ecma-262 7.3 + 7.8.4
      .replace(/\u2029/g, '\\u2029') + '"';
  },

  setupHelper: function(paramSize, name, missingParams) {
    var params = [],
        paramsInit = this.setupParams(paramSize, params, missingParams);
    var foundHelper = this.nameLookup('helpers', name, 'helper');

    return {
      params: params,
      paramsInit: paramsInit,
      name: foundHelper,
      callParams: ["depth0"].concat(params).join(", "),
      helperMissingParams: missingParams && ["depth0", this.quotedString(name)].concat(params).join(", ")
    };
  },

  setupOptions: function(paramSize, params) {
    var options = [], contexts = [], types = [], param, inverse, program;

    options.push("hash:" + this.popStack());

    if (this.options.stringParams) {
      options.push("hashTypes:" + this.popStack());
      options.push("hashContexts:" + this.popStack());
    }

    inverse = this.popStack();
    program = this.popStack();

    // Avoid setting fn and inverse if neither are set. This allows
    // helpers to do a check for `if (options.fn)`
    if (program || inverse) {
      if (!program) {
        this.context.aliases.self = "this";
        program = "self.noop";
      }

      if (!inverse) {
        this.context.aliases.self = "this";
        inverse = "self.noop";
      }

      options.push("inverse:" + inverse);
      options.push("fn:" + program);
    }

    for(var i=0; i<paramSize; i++) {
      param = this.popStack();
      params.push(param);

      if(this.options.stringParams) {
        types.push(this.popStack());
        contexts.push(this.popStack());
      }
    }

    if (this.options.stringParams) {
      options.push("contexts:[" + contexts.join(",") + "]");
      options.push("types:[" + types.join(",") + "]");
    }

    if(this.options.data) {
      options.push("data:data");
    }

    return options;
  },

  // the params and contexts arguments are passed in arrays
  // to fill in
  setupParams: function(paramSize, params, useRegister) {
    var options = '{' + this.setupOptions(paramSize, params).join(',') + '}';

    if (useRegister) {
      this.useRegister('options');
      params.push('options');
      return 'options=' + options;
    } else {
      params.push(options);
      return '';
    }
  }
};

var reservedWords = (
  "break else new var" +
  " case finally return void" +
  " catch for switch while" +
  " continue function this with" +
  " default if throw" +
  " delete in try" +
  " do instanceof typeof" +
  " abstract enum int short" +
  " boolean export interface static" +
  " byte extends long super" +
  " char final native synchronized" +
  " class float package throws" +
  " const goto private transient" +
  " debugger implements protected volatile" +
  " double import public let yield"
).split(" ");

var compilerWords = JavaScriptCompiler.RESERVED_WORDS = {};

for(var i=0, l=reservedWords.length; i<l; i++) {
  compilerWords[reservedWords[i]] = true;
}

JavaScriptCompiler.isValidJavaScriptVariableName = function(name) {
  if(!JavaScriptCompiler.RESERVED_WORDS[name] && /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name)) {
    return true;
  }
  return false;
};

exports["default"] = JavaScriptCompiler;
},{"../base":4,"../exception":12}],9:[function(require,module,exports){
"use strict";
/* jshint ignore:start */
/* Jison generated parser */
var handlebars = (function(){
var parser = {trace: function trace() { },
yy: {},
symbols_: {"error":2,"root":3,"statements":4,"EOF":5,"program":6,"simpleInverse":7,"statement":8,"openInverse":9,"closeBlock":10,"openBlock":11,"mustache":12,"partial":13,"CONTENT":14,"COMMENT":15,"OPEN_BLOCK":16,"sexpr":17,"CLOSE":18,"OPEN_INVERSE":19,"OPEN_ENDBLOCK":20,"path":21,"OPEN":22,"OPEN_UNESCAPED":23,"CLOSE_UNESCAPED":24,"OPEN_PARTIAL":25,"partialName":26,"partial_option0":27,"sexpr_repetition0":28,"sexpr_option0":29,"dataName":30,"param":31,"STRING":32,"INTEGER":33,"BOOLEAN":34,"OPEN_SEXPR":35,"CLOSE_SEXPR":36,"hash":37,"hash_repetition_plus0":38,"hashSegment":39,"ID":40,"EQUALS":41,"DATA":42,"pathSegments":43,"SEP":44,"$accept":0,"$end":1},
terminals_: {2:"error",5:"EOF",14:"CONTENT",15:"COMMENT",16:"OPEN_BLOCK",18:"CLOSE",19:"OPEN_INVERSE",20:"OPEN_ENDBLOCK",22:"OPEN",23:"OPEN_UNESCAPED",24:"CLOSE_UNESCAPED",25:"OPEN_PARTIAL",32:"STRING",33:"INTEGER",34:"BOOLEAN",35:"OPEN_SEXPR",36:"CLOSE_SEXPR",40:"ID",41:"EQUALS",42:"DATA",44:"SEP"},
productions_: [0,[3,2],[3,1],[6,2],[6,3],[6,2],[6,1],[6,1],[6,0],[4,1],[4,2],[8,3],[8,3],[8,1],[8,1],[8,1],[8,1],[11,3],[9,3],[10,3],[12,3],[12,3],[13,4],[7,2],[17,3],[17,1],[31,1],[31,1],[31,1],[31,1],[31,1],[31,3],[37,1],[39,3],[26,1],[26,1],[26,1],[30,2],[21,1],[43,3],[43,1],[27,0],[27,1],[28,0],[28,2],[29,0],[29,1],[38,1],[38,2]],
performAction: function anonymous(yytext,yyleng,yylineno,yy,yystate,$$,_$) {

var $0 = $$.length - 1;
switch (yystate) {
case 1: return new yy.ProgramNode($$[$0-1], this._$); 
break;
case 2: return new yy.ProgramNode([], this._$); 
break;
case 3:this.$ = new yy.ProgramNode([], $$[$0-1], $$[$0], this._$);
break;
case 4:this.$ = new yy.ProgramNode($$[$0-2], $$[$0-1], $$[$0], this._$);
break;
case 5:this.$ = new yy.ProgramNode($$[$0-1], $$[$0], [], this._$);
break;
case 6:this.$ = new yy.ProgramNode($$[$0], this._$);
break;
case 7:this.$ = new yy.ProgramNode([], this._$);
break;
case 8:this.$ = new yy.ProgramNode([], this._$);
break;
case 9:this.$ = [$$[$0]];
break;
case 10: $$[$0-1].push($$[$0]); this.$ = $$[$0-1]; 
break;
case 11:this.$ = new yy.BlockNode($$[$0-2], $$[$0-1].inverse, $$[$0-1], $$[$0], this._$);
break;
case 12:this.$ = new yy.BlockNode($$[$0-2], $$[$0-1], $$[$0-1].inverse, $$[$0], this._$);
break;
case 13:this.$ = $$[$0];
break;
case 14:this.$ = $$[$0];
break;
case 15:this.$ = new yy.ContentNode($$[$0], this._$);
break;
case 16:this.$ = new yy.CommentNode($$[$0], this._$);
break;
case 17:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 18:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 19:this.$ = {path: $$[$0-1], strip: stripFlags($$[$0-2], $$[$0])};
break;
case 20:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 21:this.$ = new yy.MustacheNode($$[$0-1], null, $$[$0-2], stripFlags($$[$0-2], $$[$0]), this._$);
break;
case 22:this.$ = new yy.PartialNode($$[$0-2], $$[$0-1], stripFlags($$[$0-3], $$[$0]), this._$);
break;
case 23:this.$ = stripFlags($$[$0-1], $$[$0]);
break;
case 24:this.$ = new yy.SexprNode([$$[$0-2]].concat($$[$0-1]), $$[$0], this._$);
break;
case 25:this.$ = new yy.SexprNode([$$[$0]], null, this._$);
break;
case 26:this.$ = $$[$0];
break;
case 27:this.$ = new yy.StringNode($$[$0], this._$);
break;
case 28:this.$ = new yy.IntegerNode($$[$0], this._$);
break;
case 29:this.$ = new yy.BooleanNode($$[$0], this._$);
break;
case 30:this.$ = $$[$0];
break;
case 31:$$[$0-1].isHelper = true; this.$ = $$[$0-1];
break;
case 32:this.$ = new yy.HashNode($$[$0], this._$);
break;
case 33:this.$ = [$$[$0-2], $$[$0]];
break;
case 34:this.$ = new yy.PartialNameNode($$[$0], this._$);
break;
case 35:this.$ = new yy.PartialNameNode(new yy.StringNode($$[$0], this._$), this._$);
break;
case 36:this.$ = new yy.PartialNameNode(new yy.IntegerNode($$[$0], this._$));
break;
case 37:this.$ = new yy.DataNode($$[$0], this._$);
break;
case 38:this.$ = new yy.IdNode($$[$0], this._$);
break;
case 39: $$[$0-2].push({part: $$[$0], separator: $$[$0-1]}); this.$ = $$[$0-2]; 
break;
case 40:this.$ = [{part: $$[$0]}];
break;
case 43:this.$ = [];
break;
case 44:$$[$0-1].push($$[$0]);
break;
case 47:this.$ = [$$[$0]];
break;
case 48:$$[$0-1].push($$[$0]);
break;
}
},
table: [{3:1,4:2,5:[1,3],8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],25:[1,15]},{1:[3]},{5:[1,16],8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],22:[1,13],23:[1,14],25:[1,15]},{1:[2,2]},{5:[2,9],14:[2,9],15:[2,9],16:[2,9],19:[2,9],20:[2,9],22:[2,9],23:[2,9],25:[2,9]},{4:20,6:18,7:19,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,21],20:[2,8],22:[1,13],23:[1,14],25:[1,15]},{4:20,6:22,7:19,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,21],20:[2,8],22:[1,13],23:[1,14],25:[1,15]},{5:[2,13],14:[2,13],15:[2,13],16:[2,13],19:[2,13],20:[2,13],22:[2,13],23:[2,13],25:[2,13]},{5:[2,14],14:[2,14],15:[2,14],16:[2,14],19:[2,14],20:[2,14],22:[2,14],23:[2,14],25:[2,14]},{5:[2,15],14:[2,15],15:[2,15],16:[2,15],19:[2,15],20:[2,15],22:[2,15],23:[2,15],25:[2,15]},{5:[2,16],14:[2,16],15:[2,16],16:[2,16],19:[2,16],20:[2,16],22:[2,16],23:[2,16],25:[2,16]},{17:23,21:24,30:25,40:[1,28],42:[1,27],43:26},{17:29,21:24,30:25,40:[1,28],42:[1,27],43:26},{17:30,21:24,30:25,40:[1,28],42:[1,27],43:26},{17:31,21:24,30:25,40:[1,28],42:[1,27],43:26},{21:33,26:32,32:[1,34],33:[1,35],40:[1,28],43:26},{1:[2,1]},{5:[2,10],14:[2,10],15:[2,10],16:[2,10],19:[2,10],20:[2,10],22:[2,10],23:[2,10],25:[2,10]},{10:36,20:[1,37]},{4:38,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,7],22:[1,13],23:[1,14],25:[1,15]},{7:39,8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,21],20:[2,6],22:[1,13],23:[1,14],25:[1,15]},{17:23,18:[1,40],21:24,30:25,40:[1,28],42:[1,27],43:26},{10:41,20:[1,37]},{18:[1,42]},{18:[2,43],24:[2,43],28:43,32:[2,43],33:[2,43],34:[2,43],35:[2,43],36:[2,43],40:[2,43],42:[2,43]},{18:[2,25],24:[2,25],36:[2,25]},{18:[2,38],24:[2,38],32:[2,38],33:[2,38],34:[2,38],35:[2,38],36:[2,38],40:[2,38],42:[2,38],44:[1,44]},{21:45,40:[1,28],43:26},{18:[2,40],24:[2,40],32:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],40:[2,40],42:[2,40],44:[2,40]},{18:[1,46]},{18:[1,47]},{24:[1,48]},{18:[2,41],21:50,27:49,40:[1,28],43:26},{18:[2,34],40:[2,34]},{18:[2,35],40:[2,35]},{18:[2,36],40:[2,36]},{5:[2,11],14:[2,11],15:[2,11],16:[2,11],19:[2,11],20:[2,11],22:[2,11],23:[2,11],25:[2,11]},{21:51,40:[1,28],43:26},{8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,3],22:[1,13],23:[1,14],25:[1,15]},{4:52,8:4,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,5],22:[1,13],23:[1,14],25:[1,15]},{14:[2,23],15:[2,23],16:[2,23],19:[2,23],20:[2,23],22:[2,23],23:[2,23],25:[2,23]},{5:[2,12],14:[2,12],15:[2,12],16:[2,12],19:[2,12],20:[2,12],22:[2,12],23:[2,12],25:[2,12]},{14:[2,18],15:[2,18],16:[2,18],19:[2,18],20:[2,18],22:[2,18],23:[2,18],25:[2,18]},{18:[2,45],21:56,24:[2,45],29:53,30:60,31:54,32:[1,57],33:[1,58],34:[1,59],35:[1,61],36:[2,45],37:55,38:62,39:63,40:[1,64],42:[1,27],43:26},{40:[1,65]},{18:[2,37],24:[2,37],32:[2,37],33:[2,37],34:[2,37],35:[2,37],36:[2,37],40:[2,37],42:[2,37]},{14:[2,17],15:[2,17],16:[2,17],19:[2,17],20:[2,17],22:[2,17],23:[2,17],25:[2,17]},{5:[2,20],14:[2,20],15:[2,20],16:[2,20],19:[2,20],20:[2,20],22:[2,20],23:[2,20],25:[2,20]},{5:[2,21],14:[2,21],15:[2,21],16:[2,21],19:[2,21],20:[2,21],22:[2,21],23:[2,21],25:[2,21]},{18:[1,66]},{18:[2,42]},{18:[1,67]},{8:17,9:5,11:6,12:7,13:8,14:[1,9],15:[1,10],16:[1,12],19:[1,11],20:[2,4],22:[1,13],23:[1,14],25:[1,15]},{18:[2,24],24:[2,24],36:[2,24]},{18:[2,44],24:[2,44],32:[2,44],33:[2,44],34:[2,44],35:[2,44],36:[2,44],40:[2,44],42:[2,44]},{18:[2,46],24:[2,46],36:[2,46]},{18:[2,26],24:[2,26],32:[2,26],33:[2,26],34:[2,26],35:[2,26],36:[2,26],40:[2,26],42:[2,26]},{18:[2,27],24:[2,27],32:[2,27],33:[2,27],34:[2,27],35:[2,27],36:[2,27],40:[2,27],42:[2,27]},{18:[2,28],24:[2,28],32:[2,28],33:[2,28],34:[2,28],35:[2,28],36:[2,28],40:[2,28],42:[2,28]},{18:[2,29],24:[2,29],32:[2,29],33:[2,29],34:[2,29],35:[2,29],36:[2,29],40:[2,29],42:[2,29]},{18:[2,30],24:[2,30],32:[2,30],33:[2,30],34:[2,30],35:[2,30],36:[2,30],40:[2,30],42:[2,30]},{17:68,21:24,30:25,40:[1,28],42:[1,27],43:26},{18:[2,32],24:[2,32],36:[2,32],39:69,40:[1,70]},{18:[2,47],24:[2,47],36:[2,47],40:[2,47]},{18:[2,40],24:[2,40],32:[2,40],33:[2,40],34:[2,40],35:[2,40],36:[2,40],40:[2,40],41:[1,71],42:[2,40],44:[2,40]},{18:[2,39],24:[2,39],32:[2,39],33:[2,39],34:[2,39],35:[2,39],36:[2,39],40:[2,39],42:[2,39],44:[2,39]},{5:[2,22],14:[2,22],15:[2,22],16:[2,22],19:[2,22],20:[2,22],22:[2,22],23:[2,22],25:[2,22]},{5:[2,19],14:[2,19],15:[2,19],16:[2,19],19:[2,19],20:[2,19],22:[2,19],23:[2,19],25:[2,19]},{36:[1,72]},{18:[2,48],24:[2,48],36:[2,48],40:[2,48]},{41:[1,71]},{21:56,30:60,31:73,32:[1,57],33:[1,58],34:[1,59],35:[1,61],40:[1,28],42:[1,27],43:26},{18:[2,31],24:[2,31],32:[2,31],33:[2,31],34:[2,31],35:[2,31],36:[2,31],40:[2,31],42:[2,31]},{18:[2,33],24:[2,33],36:[2,33],40:[2,33]}],
defaultActions: {3:[2,2],16:[2,1],50:[2,42]},
parseError: function parseError(str, hash) {
    throw new Error(str);
},
parse: function parse(input) {
    var self = this, stack = [0], vstack = [null], lstack = [], table = this.table, yytext = "", yylineno = 0, yyleng = 0, recovering = 0, TERROR = 2, EOF = 1;
    this.lexer.setInput(input);
    this.lexer.yy = this.yy;
    this.yy.lexer = this.lexer;
    this.yy.parser = this;
    if (typeof this.lexer.yylloc == "undefined")
        this.lexer.yylloc = {};
    var yyloc = this.lexer.yylloc;
    lstack.push(yyloc);
    var ranges = this.lexer.options && this.lexer.options.ranges;
    if (typeof this.yy.parseError === "function")
        this.parseError = this.yy.parseError;
    function popStack(n) {
        stack.length = stack.length - 2 * n;
        vstack.length = vstack.length - n;
        lstack.length = lstack.length - n;
    }
    function lex() {
        var token;
        token = self.lexer.lex() || 1;
        if (typeof token !== "number") {
            token = self.symbols_[token] || token;
        }
        return token;
    }
    var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
    while (true) {
        state = stack[stack.length - 1];
        if (this.defaultActions[state]) {
            action = this.defaultActions[state];
        } else {
            if (symbol === null || typeof symbol == "undefined") {
                symbol = lex();
            }
            action = table[state] && table[state][symbol];
        }
        if (typeof action === "undefined" || !action.length || !action[0]) {
            var errStr = "";
            if (!recovering) {
                expected = [];
                for (p in table[state])
                    if (this.terminals_[p] && p > 2) {
                        expected.push("'" + this.terminals_[p] + "'");
                    }
                if (this.lexer.showPosition) {
                    errStr = "Parse error on line " + (yylineno + 1) + ":\n" + this.lexer.showPosition() + "\nExpecting " + expected.join(", ") + ", got '" + (this.terminals_[symbol] || symbol) + "'";
                } else {
                    errStr = "Parse error on line " + (yylineno + 1) + ": Unexpected " + (symbol == 1?"end of input":"'" + (this.terminals_[symbol] || symbol) + "'");
                }
                this.parseError(errStr, {text: this.lexer.match, token: this.terminals_[symbol] || symbol, line: this.lexer.yylineno, loc: yyloc, expected: expected});
            }
        }
        if (action[0] instanceof Array && action.length > 1) {
            throw new Error("Parse Error: multiple actions possible at state: " + state + ", token: " + symbol);
        }
        switch (action[0]) {
        case 1:
            stack.push(symbol);
            vstack.push(this.lexer.yytext);
            lstack.push(this.lexer.yylloc);
            stack.push(action[1]);
            symbol = null;
            if (!preErrorSymbol) {
                yyleng = this.lexer.yyleng;
                yytext = this.lexer.yytext;
                yylineno = this.lexer.yylineno;
                yyloc = this.lexer.yylloc;
                if (recovering > 0)
                    recovering--;
            } else {
                symbol = preErrorSymbol;
                preErrorSymbol = null;
            }
            break;
        case 2:
            len = this.productions_[action[1]][1];
            yyval.$ = vstack[vstack.length - len];
            yyval._$ = {first_line: lstack[lstack.length - (len || 1)].first_line, last_line: lstack[lstack.length - 1].last_line, first_column: lstack[lstack.length - (len || 1)].first_column, last_column: lstack[lstack.length - 1].last_column};
            if (ranges) {
                yyval._$.range = [lstack[lstack.length - (len || 1)].range[0], lstack[lstack.length - 1].range[1]];
            }
            r = this.performAction.call(yyval, yytext, yyleng, yylineno, this.yy, action[1], vstack, lstack);
            if (typeof r !== "undefined") {
                return r;
            }
            if (len) {
                stack = stack.slice(0, -1 * len * 2);
                vstack = vstack.slice(0, -1 * len);
                lstack = lstack.slice(0, -1 * len);
            }
            stack.push(this.productions_[action[1]][0]);
            vstack.push(yyval.$);
            lstack.push(yyval._$);
            newState = table[stack[stack.length - 2]][stack[stack.length - 1]];
            stack.push(newState);
            break;
        case 3:
            return true;
        }
    }
    return true;
}
};


function stripFlags(open, close) {
  return {
    left: open.charAt(2) === '~',
    right: close.charAt(0) === '~' || close.charAt(1) === '~'
  };
}

/* Jison generated lexer */
var lexer = (function(){
var lexer = ({EOF:1,
parseError:function parseError(str, hash) {
        if (this.yy.parser) {
            this.yy.parser.parseError(str, hash);
        } else {
            throw new Error(str);
        }
    },
setInput:function (input) {
        this._input = input;
        this._more = this._less = this.done = false;
        this.yylineno = this.yyleng = 0;
        this.yytext = this.matched = this.match = '';
        this.conditionStack = ['INITIAL'];
        this.yylloc = {first_line:1,first_column:0,last_line:1,last_column:0};
        if (this.options.ranges) this.yylloc.range = [0,0];
        this.offset = 0;
        return this;
    },
input:function () {
        var ch = this._input[0];
        this.yytext += ch;
        this.yyleng++;
        this.offset++;
        this.match += ch;
        this.matched += ch;
        var lines = ch.match(/(?:\r\n?|\n).*/g);
        if (lines) {
            this.yylineno++;
            this.yylloc.last_line++;
        } else {
            this.yylloc.last_column++;
        }
        if (this.options.ranges) this.yylloc.range[1]++;

        this._input = this._input.slice(1);
        return ch;
    },
unput:function (ch) {
        var len = ch.length;
        var lines = ch.split(/(?:\r\n?|\n)/g);

        this._input = ch + this._input;
        this.yytext = this.yytext.substr(0, this.yytext.length-len-1);
        //this.yyleng -= len;
        this.offset -= len;
        var oldLines = this.match.split(/(?:\r\n?|\n)/g);
        this.match = this.match.substr(0, this.match.length-1);
        this.matched = this.matched.substr(0, this.matched.length-1);

        if (lines.length-1) this.yylineno -= lines.length-1;
        var r = this.yylloc.range;

        this.yylloc = {first_line: this.yylloc.first_line,
          last_line: this.yylineno+1,
          first_column: this.yylloc.first_column,
          last_column: lines ?
              (lines.length === oldLines.length ? this.yylloc.first_column : 0) + oldLines[oldLines.length - lines.length].length - lines[0].length:
              this.yylloc.first_column - len
          };

        if (this.options.ranges) {
            this.yylloc.range = [r[0], r[0] + this.yyleng - len];
        }
        return this;
    },
more:function () {
        this._more = true;
        return this;
    },
less:function (n) {
        this.unput(this.match.slice(n));
    },
pastInput:function () {
        var past = this.matched.substr(0, this.matched.length - this.match.length);
        return (past.length > 20 ? '...':'') + past.substr(-20).replace(/\n/g, "");
    },
upcomingInput:function () {
        var next = this.match;
        if (next.length < 20) {
            next += this._input.substr(0, 20-next.length);
        }
        return (next.substr(0,20)+(next.length > 20 ? '...':'')).replace(/\n/g, "");
    },
showPosition:function () {
        var pre = this.pastInput();
        var c = new Array(pre.length + 1).join("-");
        return pre + this.upcomingInput() + "\n" + c+"^";
    },
next:function () {
        if (this.done) {
            return this.EOF;
        }
        if (!this._input) this.done = true;

        var token,
            match,
            tempMatch,
            index,
            col,
            lines;
        if (!this._more) {
            this.yytext = '';
            this.match = '';
        }
        var rules = this._currentRules();
        for (var i=0;i < rules.length; i++) {
            tempMatch = this._input.match(this.rules[rules[i]]);
            if (tempMatch && (!match || tempMatch[0].length > match[0].length)) {
                match = tempMatch;
                index = i;
                if (!this.options.flex) break;
            }
        }
        if (match) {
            lines = match[0].match(/(?:\r\n?|\n).*/g);
            if (lines) this.yylineno += lines.length;
            this.yylloc = {first_line: this.yylloc.last_line,
                           last_line: this.yylineno+1,
                           first_column: this.yylloc.last_column,
                           last_column: lines ? lines[lines.length-1].length-lines[lines.length-1].match(/\r?\n?/)[0].length : this.yylloc.last_column + match[0].length};
            this.yytext += match[0];
            this.match += match[0];
            this.matches = match;
            this.yyleng = this.yytext.length;
            if (this.options.ranges) {
                this.yylloc.range = [this.offset, this.offset += this.yyleng];
            }
            this._more = false;
            this._input = this._input.slice(match[0].length);
            this.matched += match[0];
            token = this.performAction.call(this, this.yy, this, rules[index],this.conditionStack[this.conditionStack.length-1]);
            if (this.done && this._input) this.done = false;
            if (token) return token;
            else return;
        }
        if (this._input === "") {
            return this.EOF;
        } else {
            return this.parseError('Lexical error on line '+(this.yylineno+1)+'. Unrecognized text.\n'+this.showPosition(),
                    {text: "", token: null, line: this.yylineno});
        }
    },
lex:function lex() {
        var r = this.next();
        if (typeof r !== 'undefined') {
            return r;
        } else {
            return this.lex();
        }
    },
begin:function begin(condition) {
        this.conditionStack.push(condition);
    },
popState:function popState() {
        return this.conditionStack.pop();
    },
_currentRules:function _currentRules() {
        return this.conditions[this.conditionStack[this.conditionStack.length-1]].rules;
    },
topState:function () {
        return this.conditionStack[this.conditionStack.length-2];
    },
pushState:function begin(condition) {
        this.begin(condition);
    }});
lexer.options = {};
lexer.performAction = function anonymous(yy,yy_,$avoiding_name_collisions,YY_START) {


function strip(start, end) {
  return yy_.yytext = yy_.yytext.substr(start, yy_.yyleng-end);
}


var YYSTATE=YY_START
switch($avoiding_name_collisions) {
case 0:
                                   if(yy_.yytext.slice(-2) === "\\\\") {
                                     strip(0,1);
                                     this.begin("mu");
                                   } else if(yy_.yytext.slice(-1) === "\\") {
                                     strip(0,1);
                                     this.begin("emu");
                                   } else {
                                     this.begin("mu");
                                   }
                                   if(yy_.yytext) return 14;
                                 
break;
case 1:return 14;
break;
case 2:
                                   this.popState();
                                   return 14;
                                 
break;
case 3:strip(0,4); this.popState(); return 15;
break;
case 4:return 35;
break;
case 5:return 36;
break;
case 6:return 25;
break;
case 7:return 16;
break;
case 8:return 20;
break;
case 9:return 19;
break;
case 10:return 19;
break;
case 11:return 23;
break;
case 12:return 22;
break;
case 13:this.popState(); this.begin('com');
break;
case 14:strip(3,5); this.popState(); return 15;
break;
case 15:return 22;
break;
case 16:return 41;
break;
case 17:return 40;
break;
case 18:return 40;
break;
case 19:return 44;
break;
case 20:// ignore whitespace
break;
case 21:this.popState(); return 24;
break;
case 22:this.popState(); return 18;
break;
case 23:yy_.yytext = strip(1,2).replace(/\\"/g,'"'); return 32;
break;
case 24:yy_.yytext = strip(1,2).replace(/\\'/g,"'"); return 32;
break;
case 25:return 42;
break;
case 26:return 34;
break;
case 27:return 34;
break;
case 28:return 33;
break;
case 29:return 40;
break;
case 30:yy_.yytext = strip(1,2); return 40;
break;
case 31:return 'INVALID';
break;
case 32:return 5;
break;
}
};
lexer.rules = [/^(?:[^\x00]*?(?=(\{\{)))/,/^(?:[^\x00]+)/,/^(?:[^\x00]{2,}?(?=(\{\{|\\\{\{|\\\\\{\{|$)))/,/^(?:[\s\S]*?--\}\})/,/^(?:\()/,/^(?:\))/,/^(?:\{\{(~)?>)/,/^(?:\{\{(~)?#)/,/^(?:\{\{(~)?\/)/,/^(?:\{\{(~)?\^)/,/^(?:\{\{(~)?\s*else\b)/,/^(?:\{\{(~)?\{)/,/^(?:\{\{(~)?&)/,/^(?:\{\{!--)/,/^(?:\{\{![\s\S]*?\}\})/,/^(?:\{\{(~)?)/,/^(?:=)/,/^(?:\.\.)/,/^(?:\.(?=([=~}\s\/.)])))/,/^(?:[\/.])/,/^(?:\s+)/,/^(?:\}(~)?\}\})/,/^(?:(~)?\}\})/,/^(?:"(\\["]|[^"])*")/,/^(?:'(\\[']|[^'])*')/,/^(?:@)/,/^(?:true(?=([~}\s)])))/,/^(?:false(?=([~}\s)])))/,/^(?:-?[0-9]+(?=([~}\s)])))/,/^(?:([^\s!"#%-,\.\/;->@\[-\^`\{-~]+(?=([=~}\s\/.)]))))/,/^(?:\[[^\]]*\])/,/^(?:.)/,/^(?:$)/];
lexer.conditions = {"mu":{"rules":[4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32],"inclusive":false},"emu":{"rules":[2],"inclusive":false},"com":{"rules":[3],"inclusive":false},"INITIAL":{"rules":[0,1,32],"inclusive":true}};
return lexer;})()
parser.lexer = lexer;
function Parser () { this.yy = {}; }Parser.prototype = parser;parser.Parser = Parser;
return new Parser;
})();exports["default"] = handlebars;
/* jshint ignore:end */
},{}],10:[function(require,module,exports){
"use strict";
var Visitor = require("./visitor")["default"];

function print(ast) {
  return new PrintVisitor().accept(ast);
}

exports.print = print;function PrintVisitor() {
  this.padding = 0;
}

exports.PrintVisitor = PrintVisitor;PrintVisitor.prototype = new Visitor();

PrintVisitor.prototype.pad = function(string, newline) {
  var out = "";

  for(var i=0,l=this.padding; i<l; i++) {
    out = out + "  ";
  }

  out = out + string;

  if(newline !== false) { out = out + "\n"; }
  return out;
};

PrintVisitor.prototype.program = function(program) {
  var out = "",
      statements = program.statements,
      i, l;

  for(i=0, l=statements.length; i<l; i++) {
    out = out + this.accept(statements[i]);
  }

  this.padding--;

  return out;
};

PrintVisitor.prototype.block = function(block) {
  var out = "";

  out = out + this.pad("BLOCK:");
  this.padding++;
  out = out + this.accept(block.mustache);
  if (block.program) {
    out = out + this.pad("PROGRAM:");
    this.padding++;
    out = out + this.accept(block.program);
    this.padding--;
  }
  if (block.inverse) {
    if (block.program) { this.padding++; }
    out = out + this.pad("{{^}}");
    this.padding++;
    out = out + this.accept(block.inverse);
    this.padding--;
    if (block.program) { this.padding--; }
  }
  this.padding--;

  return out;
};

PrintVisitor.prototype.sexpr = function(sexpr) {
  var params = sexpr.params, paramStrings = [], hash;

  for(var i=0, l=params.length; i<l; i++) {
    paramStrings.push(this.accept(params[i]));
  }

  params = "[" + paramStrings.join(", ") + "]";

  hash = sexpr.hash ? " " + this.accept(sexpr.hash) : "";

  return this.accept(sexpr.id) + " " + params + hash;
};

PrintVisitor.prototype.mustache = function(mustache) {
  return this.pad("{{ " + this.accept(mustache.sexpr) + " }}");
};

PrintVisitor.prototype.partial = function(partial) {
  var content = this.accept(partial.partialName);
  if(partial.context) { content = content + " " + this.accept(partial.context); }
  return this.pad("{{> " + content + " }}");
};

PrintVisitor.prototype.hash = function(hash) {
  var pairs = hash.pairs;
  var joinedPairs = [], left, right;

  for(var i=0, l=pairs.length; i<l; i++) {
    left = pairs[i][0];
    right = this.accept(pairs[i][1]);
    joinedPairs.push( left + "=" + right );
  }

  return "HASH{" + joinedPairs.join(", ") + "}";
};

PrintVisitor.prototype.STRING = function(string) {
  return '"' + string.string + '"';
};

PrintVisitor.prototype.INTEGER = function(integer) {
  return "INTEGER{" + integer.integer + "}";
};

PrintVisitor.prototype.BOOLEAN = function(bool) {
  return "BOOLEAN{" + bool.bool + "}";
};

PrintVisitor.prototype.ID = function(id) {
  var path = id.parts.join("/");
  if(id.parts.length > 1) {
    return "PATH:" + path;
  } else {
    return "ID:" + path;
  }
};

PrintVisitor.prototype.PARTIAL_NAME = function(partialName) {
    return "PARTIAL:" + partialName.name;
};

PrintVisitor.prototype.DATA = function(data) {
  return "@" + this.accept(data.id);
};

PrintVisitor.prototype.content = function(content) {
  return this.pad("CONTENT[ '" + content.string + "' ]");
};

PrintVisitor.prototype.comment = function(comment) {
  return this.pad("{{! '" + comment.comment + "' }}");
};
},{"./visitor":11}],11:[function(require,module,exports){
"use strict";
function Visitor() {}

Visitor.prototype = {
  constructor: Visitor,

  accept: function(object) {
    return this[object.type](object);
  }
};

exports["default"] = Visitor;
},{}],12:[function(require,module,exports){
"use strict";

var errorProps = ['description', 'fileName', 'lineNumber', 'message', 'name', 'number', 'stack'];

function Exception(message, node) {
  var line;
  if (node && node.firstLine) {
    line = node.firstLine;

    message += ' - ' + line + ':' + node.firstColumn;
  }

  var tmp = Error.prototype.constructor.call(this, message);

  // Unfortunately errors are not enumerable in Chrome (at least), so `for prop in tmp` doesn't work.
  for (var idx = 0; idx < errorProps.length; idx++) {
    this[errorProps[idx]] = tmp[errorProps[idx]];
  }

  if (line) {
    this.lineNumber = line;
    this.column = node.firstColumn;
  }
}

Exception.prototype = new Error();

exports["default"] = Exception;
},{}],13:[function(require,module,exports){
"use strict";
var Utils = require("./utils");
var Exception = require("./exception")["default"];
var COMPILER_REVISION = require("./base").COMPILER_REVISION;
var REVISION_CHANGES = require("./base").REVISION_CHANGES;

function checkRevision(compilerInfo) {
  var compilerRevision = compilerInfo && compilerInfo[0] || 1,
      currentRevision = COMPILER_REVISION;

  if (compilerRevision !== currentRevision) {
    if (compilerRevision < currentRevision) {
      var runtimeVersions = REVISION_CHANGES[currentRevision],
          compilerVersions = REVISION_CHANGES[compilerRevision];
      throw new Exception("Template was precompiled with an older version of Handlebars than the current runtime. "+
            "Please update your precompiler to a newer version ("+runtimeVersions+") or downgrade your runtime to an older version ("+compilerVersions+").");
    } else {
      // Use the embedded version info since the runtime doesn't know about this revision yet
      throw new Exception("Template was precompiled with a newer version of Handlebars than the current runtime. "+
            "Please update your runtime to a newer version ("+compilerInfo[1]+").");
    }
  }
}

exports.checkRevision = checkRevision;// TODO: Remove this line and break up compilePartial

function template(templateSpec, env) {
  if (!env) {
    throw new Exception("No environment passed to template");
  }

  // Note: Using env.VM references rather than local var references throughout this section to allow
  // for external users to override these as psuedo-supported APIs.
  var invokePartialWrapper = function(partial, name, context, helpers, partials, data) {
    var result = env.VM.invokePartial.apply(this, arguments);
    if (result != null) { return result; }

    if (env.compile) {
      var options = { helpers: helpers, partials: partials, data: data };
      partials[name] = env.compile(partial, { data: data !== undefined }, env);
      return partials[name](context, options);
    } else {
      throw new Exception("The partial " + name + " could not be compiled when running in runtime-only mode");
    }
  };

  // Just add water
  var container = {
    escapeExpression: Utils.escapeExpression,
    invokePartial: invokePartialWrapper,
    programs: [],
    program: function(i, fn, data) {
      var programWrapper = this.programs[i];
      if(data) {
        programWrapper = program(i, fn, data);
      } else if (!programWrapper) {
        programWrapper = this.programs[i] = program(i, fn);
      }
      return programWrapper;
    },
    merge: function(param, common) {
      var ret = param || common;

      if (param && common && (param !== common)) {
        ret = {};
        Utils.extend(ret, common);
        Utils.extend(ret, param);
      }
      return ret;
    },
    programWithDepth: env.VM.programWithDepth,
    noop: env.VM.noop,
    compilerInfo: null
  };

  return function(context, options) {
    options = options || {};
    var namespace = options.partial ? options : env,
        helpers,
        partials;

    if (!options.partial) {
      helpers = options.helpers;
      partials = options.partials;
    }
    var result = templateSpec.call(
          container,
          namespace, context,
          helpers,
          partials,
          options.data);

    if (!options.partial) {
      env.VM.checkRevision(container.compilerInfo);
    }

    return result;
  };
}

exports.template = template;function programWithDepth(i, fn, data /*, $depth */) {
  var args = Array.prototype.slice.call(arguments, 3);

  var prog = function(context, options) {
    options = options || {};

    return fn.apply(this, [context, options.data || data].concat(args));
  };
  prog.program = i;
  prog.depth = args.length;
  return prog;
}

exports.programWithDepth = programWithDepth;function program(i, fn, data) {
  var prog = function(context, options) {
    options = options || {};

    return fn(context, options.data || data);
  };
  prog.program = i;
  prog.depth = 0;
  return prog;
}

exports.program = program;function invokePartial(partial, name, context, helpers, partials, data) {
  var options = { partial: true, helpers: helpers, partials: partials, data: data };

  if(partial === undefined) {
    throw new Exception("The partial " + name + " could not be found");
  } else if(partial instanceof Function) {
    return partial(context, options);
  }
}

exports.invokePartial = invokePartial;function noop() { return ""; }

exports.noop = noop;
},{"./base":4,"./exception":12,"./utils":15}],14:[function(require,module,exports){
"use strict";
// Build out our basic SafeString type
function SafeString(string) {
  this.string = string;
}

SafeString.prototype.toString = function() {
  return "" + this.string;
};

exports["default"] = SafeString;
},{}],15:[function(require,module,exports){
"use strict";
/*jshint -W004 */
var SafeString = require("./safe-string")["default"];

var escape = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "`": "&#x60;"
};

var badChars = /[&<>"'`]/g;
var possible = /[&<>"'`]/;

function escapeChar(chr) {
  return escape[chr] || "&amp;";
}

function extend(obj, value) {
  for(var key in value) {
    if(Object.prototype.hasOwnProperty.call(value, key)) {
      obj[key] = value[key];
    }
  }
}

exports.extend = extend;var toString = Object.prototype.toString;
exports.toString = toString;
// Sourced from lodash
// https://github.com/bestiejs/lodash/blob/master/LICENSE.txt
var isFunction = function(value) {
  return typeof value === 'function';
};
// fallback for older versions of Chrome and Safari
if (isFunction(/x/)) {
  isFunction = function(value) {
    return typeof value === 'function' && toString.call(value) === '[object Function]';
  };
}
var isFunction;
exports.isFunction = isFunction;
var isArray = Array.isArray || function(value) {
  return (value && typeof value === 'object') ? toString.call(value) === '[object Array]' : false;
};
exports.isArray = isArray;

function escapeExpression(string) {
  // don't escape SafeStrings, since they're already safe
  if (string instanceof SafeString) {
    return string.toString();
  } else if (!string && string !== 0) {
    return "";
  }

  // Force a string conversion as this will be done by the append regardless and
  // the regex test will do this transparently behind the scenes, causing issues if
  // an object's to string has escaped characters in it.
  string = "" + string;

  if(!possible.test(string)) { return string; }
  return string.replace(badChars, escapeChar);
}

exports.escapeExpression = escapeExpression;function isEmpty(value) {
  if (!value && value !== 0) {
    return true;
  } else if (isArray(value) && value.length === 0) {
    return true;
  } else {
    return false;
  }
}

exports.isEmpty = isEmpty;
},{"./safe-string":14}],16:[function(require,module,exports){
// USAGE:
// var handlebars = require('handlebars');

// var local = handlebars.create();

var handlebars = require('../dist/cjs/handlebars')["default"];

handlebars.Visitor = require('../dist/cjs/handlebars/compiler/visitor')["default"];

var printer = require('../dist/cjs/handlebars/compiler/printer');
handlebars.PrintVisitor = printer.PrintVisitor;
handlebars.print = printer.print;

module.exports = handlebars;

// Publish a Node.js require() handler for .handlebars and .hbs files
if (typeof require !== 'undefined' && require.extensions) {
  var extension = function(module, filename) {
    var fs = require("fs");
    var templateString = fs.readFileSync(filename, "utf8");
    module.exports = handlebars.compile(templateString);
  };
  require.extensions[".handlebars"] = extension;
  require.extensions[".hbs"] = extension;
}

},{"../dist/cjs/handlebars":2,"../dist/cjs/handlebars/compiler/printer":10,"../dist/cjs/handlebars/compiler/visitor":11,"fs":1}],17:[function(require,module,exports){
// Create a simple path alias to allow browserify to resolve
// the runtime on a supported path.
module.exports = require('./dist/cjs/handlebars.runtime');

},{"./dist/cjs/handlebars.runtime":3}],18:[function(require,module,exports){
module.exports = require("handlebars/runtime")["default"];

},{"handlebars/runtime":17}],19:[function(require,module,exports){
var App, Conversation, Message, User, command_center, oauth, object, parley;

object = {};

module.exports = object;


/*   PARLEY.JS CHAT LIBRARY EXTRODINAIRE */

App = (function() {
  function App() {
    this.current_users = [];
    this.open_conversations = [];
    this.conversations = [];
    (function() {
      var s, script;
      script = document.createElement('script');
      script.type = 'text/javascript';
      script.async = true;
      script.src = "/socket.io/socket.io.js";
      s = document.getElementsByTagName('script')[0];
      return s.parentNode.insertBefore(script, s);
    })();
    (function() {
      var po, s;
      po = document.createElement('script');
      po.type = 'text/javascript';
      po.async = true;
      po.src = 'https://apis.google.com/js/client:plusone.js';
      s = document.getElementsByTagName('script')[0];
      return s.parentNode.insertBefore(po, s);
    })();
    this.server.on('persistent_convo', this.load_persistent_convo.bind(this));
    this.server.on('message', this.update_persistent_convos.bind(this));
    this.server.on('current_users', this.load_current_users.bind(this));
    this.server.on('user_logged_on', this.user_logged_on.bind(this));
    this.server.on('user_logged_off', this.user_logged_off.bind(this));
  }

  App.prototype.server = io.connect('wss://' + window.location.hostname);

  App.prototype.load_persistent_convo = function(convo_partners, messages) {
    var convo, message, new_message, parsed, parsed_messages, _i, _len;
    parsed_messages = [];
    for (_i = 0, _len = messages.length; _i < _len; _i++) {
      message = messages[_i];
      parsed = JSON.parse(message);
      new_message = new Message(parsed.recipients, parsed.sender, parsed.content, parsed.image, parsed.time_stamp);
      parsed_messages.push(new_message);
    }
    convo = new Conversation(convo_partners, parsed_messages);
    return this.conversations.push(convo);
  };

  App.prototype.update_persistent_convos = function(message) {
    var convo, convo_members_ids, convo_partners, corres_convo, i, new_convo, new_message, online_user, open_convo, user_id, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _m, _ref, _ref1, _ref2;
    console.log("i hear you click");
    _ref = this.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      open_convo = _ref[_i];
      if (message.convo_id === open_convo) {
        return;
      }
    }
    console.log('i know the convo isnt open');
    _ref1 = this.conversations;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      convo = _ref1[_j];
      if (convo.message_filter === message.convo_id) {
        corres_convo = convo;
      }
    }
    new_message = new Message(message.recipients, message.sender, message.content, message.image, message.time_stamp);
    if (corres_convo) {
      corres_convo.add_message(new_message);
      return console.log("I think the convo exists");
    } else {
      console.log("I think the convo doesn't exist");
      convo_members_ids = new_message.convo_id.split(',');
      for (i = _k = 0, _len2 = convo_members_ids.length; _k < _len2; i = ++_k) {
        user_id = convo_members_ids[i];
        if (user_id === this.me.image_url) {
          convo_members_ids.splice(i, 1);
        }
      }
      convo_partners = [];
      for (_l = 0, _len3 = convo_members_ids.length; _l < _len3; _l++) {
        user_id = convo_members_ids[_l];
        _ref2 = this.current_users;
        for (_m = 0, _len4 = _ref2.length; _m < _len4; _m++) {
          online_user = _ref2[_m];
          if (user_id === online_user.image_url) {
            convo_partners.push(online_user);
          }
        }
      }
      new_convo = new Conversation(convo_partners);
      this.conversations.push(new_convo);
      new_convo.add_message(new_message);
      return console.log(this.conversations);
    }
  };

  App.prototype.load_current_users = function(logged_on) {
    var i, user, _i, _len, _ref, _results;
    this.current_users = logged_on;
    _ref = this.current_users;
    _results = [];
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      if (user.image_url === this.me.image_url) {
        _results.push(this.current_users.splice(i, 1));
      } else {
        _results.push(void 0);
      }
    }
    return _results;
  };

  App.prototype.user_logged_on = function(display_name, image_url) {
    var user;
    user = new User(display_name, image_url);
    return this.current_users.push(user);
  };

  App.prototype.user_logged_off = function(display_name, image_url) {
    var i, user, _i, _len, _ref;
    console.log(this.current_users);
    _ref = this.current_users;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      if (image_url === user.image_url) {
        this.current_users.splice(i, 1);
      }
    }
    return console.log(this.current_users);
  };

  return App;

})();

parley = new App();

module.exports = parley;

oauth = require('./oauth.coffee');

command_center = require('./command_center_view.coffee');

Conversation = require('./conversation_model.coffee');

User = require('./user_model.coffee');

Message = require('./message_model.coffee');

App.prototype.command_center = command_center;

App.prototype.oauth = oauth;


},{"./command_center_view.coffee":21,"./conversation_model.coffee":22,"./message_model.coffee":23,"./oauth.coffee":25,"./user_model.coffee":34}],20:[function(require,module,exports){
var ChatRoom, Conversation, Handlebars, Message, MessageView, app, chat_room_template;

app = require('./app.coffee');

Message = require('./message_model.coffee');

MessageView = require('./message_view.coffee');

Conversation = require('./conversation_model.coffee');

chat_room_template = require('./templates/chat_room.hbs');

Handlebars = require('hbsfy/runtime');

Handlebars.registerHelper('title_bar_function', function() {
  if (this.convo_partners.length < 2) {
    return this.convo_partners[0].display_name;
  } else {

  }
  return this.first_name_list;
});

ChatRoom = (function() {
  function ChatRoom(convo) {
    this.convo = convo;
    this.render();
    $('body').append(this.$element);
    this.$mirror_div = $("<div class='mirrordiv'></div>");
    this.$element.find('section.conversation').append(this.$mirror_div);
    this.hidden_div_height = this.$element.find('.mirrordiv').css('height');
    this.$file_upload = this.$element.find('label.img_upload');
    this.loadPersistentMessages();
    app.server.on('message', this.message_callback.bind(this));
    app.server.on('user_offline', this.user_offline_callback.bind(this));
    app.server.on('typing_notification', this.typing_notification_callback.bind(this));
    this.$element.find('.chat-close').on('click', this.closeWindow.bind(this));
    this.$element.find('.send').on('keypress', this.sendOnEnter.bind(this));
    this.$element.find('.send').on('keyup', this.emitTypingNotification.bind(this));
    this.$element.find('.send').on('keyup', this.grow_message_field.bind(this));
    this.$element.find('.send').on('keyup', this.toggle_file_upload_button.bind(this));
    this.$element.find('.top-bar, minify ').on('click', this.toggleChat.bind(this));
    this.$element.on('click', this.removeNotifications.bind(this));
    this.$file_upload.on('change', this.file_upload.bind(this));
    app.title_notification = {
      notified: false,
      page_title: $('html title').html()
    };
  }

  ChatRoom.prototype.message_callback = function(message) {
    var new_message;
    if (this.convo.message_filter === message.convo_id) {
      new_message = new Message(message.recipients, message.sender, message.content, message.image, message.time_stamp);
      this.convo.add_message(new_message);
      this.renderDiscussion();
      this.$element.find('.top-bar').addClass('new-message');
      return this.titleAlert();
    }
  };

  ChatRoom.prototype.user_offline_callback = function() {
    var message;
    message = new Message(app.me, {
      image_url: 'http://storage.googleapis.com/parley-assets/server_network.png'
    }, "This user is no longer online", false, new Date());
    this.convo.add_message(message);
    return this.renderDiscussion();
  };

  ChatRoom.prototype.typing_notification_callback = function(convo_id, typist, bool) {
    var typing_notification;
    if (convo_id === this.convo.message_filter) {
      if (bool) {
        if (this.$discussion.find('.incoming').length === 0) {
          typing_notification = "<li class='incoming'><div class='avatar'><img src='" + typist.image_url + "'/></div><div class='messages'><p>" + typist.display_name + " is typing...</p></div></li>";
          this.$discussion.append(typing_notification);
          return this.scrollToLastMessage();
        }
      } else {
        this.$discussion.find('.incoming').remove();
        return this.scrollToLastMessage();
      }
    }
  };

  ChatRoom.prototype.add_member = function(new_user) {
    var new_convo_group, new_convo_partners, open_convo, _i, _len, _ref;
    new_convo_partners = this.convo.convo_partners.concat(new_user);
    new_convo_group = new Conversation(new_convo_partners);
    app.conversations.push(new_convo_group);
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      open_convo = _ref[_i];
      if (open_convo === this.convo.message_filter) {
        app.open_conversations.splice(i, 1);
      }
    }
    app.open_conversations.push(new_convo_group.message_filter);
    this.convo = new_convo_group;
    return this.render();
  };

  ChatRoom.prototype.render = function() {
    this.$element = $(chat_room_template(this.convo));
    return this.$discussion = this.$element.find('.discussion');
  };

  ChatRoom.prototype.renderDiscussion = function() {
    var new_message;
    new_message = this.convo.messages.slice(-1)[0];
    this.appendMessage(new_message);
    return this.scrollToLastMessage();
  };

  ChatRoom.prototype.appendMessage = function(message) {
    var message_view;
    message_view = new MessageView(message);
    message_view.render();
    return this.$discussion.append(message_view.$element);
  };

  ChatRoom.prototype.scrollToLastMessage = function() {
    return this.$discussion.scrollTop(this.$discussion.find('li:last-child').offset().top + this.$discussion.scrollTop());
  };

  ChatRoom.prototype.loadPersistentMessages = function() {
    var message, _i, _len, _ref;
    _ref = this.convo.messages;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      message = _ref[_i];
      this.appendMessage(message);
    }
    if (this.convo.messages.length > 0) {
      return this.scrollToLastMessage();
    }
  };

  ChatRoom.prototype.sendOnEnter = function(e) {
    if (e.keyCode === 13) {
      this.sendMessage();
      return this.removeNotifications();
    }
  };

  ChatRoom.prototype.sendMessage = function() {
    var message;
    message = new Message(this.convo.convo_partners, app.me, this.$element.find('.send').val());
    this.convo.add_message(message);
    this.renderDiscussion();
    app.server.emit('message', message);
    this.$element.find('.send').val('');
    return this.emitTypingNotification();
  };

  ChatRoom.prototype.toggleChat = function(e) {
    e.preventDefault();
    this.$discussion.toggle();
    if (this.$discussion.attr('display') === !"none") {
      return this.scrollToLastMessage;
    }
  };

  ChatRoom.prototype.closeWindow = function(e) {
    var i, open_convo, _i, _len, _ref;
    e.preventDefault();
    e.stopPropagation();
    _ref = app.open_conversations;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      open_convo = _ref[i];
      if (open_convo === this.convo.message_filter) {
        app.open_conversations.splice(i, 1);
      }
    }
    app.server.removeListener('message', this.message_callback.bind(this));
    app.server.removeListener('user_offline', this.user_offline_callback.bind(this));
    app.server.removeListener('typing_notification', this.typing_notification_callback.bind(this));
    this.$element.find('.chat-close').off();
    this.$element.find('.send').off();
    this.$element.find('.send').off();
    this.$element.find('.top-bar').off();
    this.$element.off();
    this.$discussion.off();
    this.$element.remove();
    return delete this;
  };

  ChatRoom.prototype.removeNotifications = function(e) {
    this.$element.find('.top-bar').removeClass('new-message');
    if (app.title_notification.notified) {
      return this.clearTitleNotification();
    }
  };

  ChatRoom.prototype.emitTypingNotification = function(e) {
    if (this.$element.find('.send').val() !== "") {
      return app.server.emit('user_typing', this.convo.convo_partners_image_urls, app.me, true);
    } else {
      return app.server.emit('user_typing', this.convo.convo_partners_image_urls, app.me, false);
    }
  };

  ChatRoom.prototype.clearTitleNotification = function() {
    app.clearAlert();
    $('html title').html(app.title_notification.page_title);
    return app.title_notification.notified = false;
  };

  ChatRoom.prototype.titleAlert = function() {
    var alert, sender_name, setAlert, title_alert;
    if (!app.title_notification.notified) {
      sender_name = this.convo.messages[this.convo.messages.length - 1].sender.display_name;
      alert = "Pending ** " + sender_name;
      setAlert = function() {
        if ($('html title').html() === app.title_notification.page_title) {
          return $('html title').html(alert);
        } else {
          return $('html title').html(app.title_notification.page_title);
        }
      };
      title_alert = setInterval(setAlert, 2200);
      app.clear_alert = function() {
        return clearInterval(title_alert);
      };
      return app.title_notification.notified = true;
    }
  };

  ChatRoom.prototype.file_upload = function() {
    var file;
    file = this.$element.find('.parley_file_upload').get(0).files[0];
    return app.oauth.file_upload(file, this.convo.convo_partners, this.convo.message_filter);
  };

  ChatRoom.prototype.grow_message_field = function() {
    var $txt, adjusted_content, content;
    $txt = this.$element.find('textarea.send');
    content = $txt.val();
    adjusted_content = content.replace(/\n/g, "<br>");
    this.$mirror_div.html(adjusted_content);
    this.hidden_div_height = this.$mirror_div.css('height');
    if (this.hidden_div_height !== $txt.css('height')) {
      return $txt.css('height', this.hidden_div_height);
    }
  };

  ChatRoom.prototype.toggle_file_upload_button = function() {
    if (this.$element.find('textarea.send').val() !== "") {
      if (this.$element.find('label.img_upload').length === 1) {
        return this.$element.find('label.img_upload').remove();
      }
    } else {
      if (this.$element.find('label.img_upload').length === 0) {
        this.$element.find('section.conversation').append(this.$file_upload);
        return this.$file_upload.on('change', this.file_upload.bind(this));
      }
    }
  };

  return ChatRoom;

})();

module.exports = ChatRoom;


},{"./app.coffee":19,"./conversation_model.coffee":22,"./message_model.coffee":23,"./message_view.coffee":24,"./templates/chat_room.hbs":27,"hbsfy/runtime":18}],21:[function(require,module,exports){
var ChatRoom, CommandCenter, Conversation, PersistentConversationView, UserView, app, logged_in_template, logged_out_template, profile_template;

app = require('./app.coffee');

UserView = require('./user_view.coffee');

PersistentConversationView = require('./persistent_conversation_view.coffee');

logged_out_template = require('./templates/logged_out.hbs');

logged_in_template = require('./templates/logged_in.hbs');

profile_template = require('./templates/profile.hbs');

Conversation = require('./conversation_model.coffee');

ChatRoom = require('./chat_room_view.coffee');

CommandCenter = (function() {
  function CommandCenter() {
    this.menu = "default";
    this.$add_user_bar = $('<div class="add-user-bar"><a class="cancel">Cancel</a><a class="confirm disabled">Add People</a> </div>');
    this.new_convo_params = [];
    $('body').append(logged_out_template());
    $("ul.login-bar").hide();
    $('.parley .persistent-bar.logged-out').on('click', function(e) {
      return $('ul.login-bar').toggle();
    });
  }

  CommandCenter.prototype.log_in = function() {
    this.logged_in = true;
    $(".parley .persistent-bar.logged_out").off();
    this.$element = $(logged_in_template(app.me));
    $('.parley section.controller').html(this.$element);
    $('.persistent-bar').on('click', this.toggle_command_center.bind(this));
    $('.parley div.controller-bar a.messages').on('click', this.toggle_persistent_convos.bind(this));
    $('.parley div.controller-bar a.active-users').on('click', this.toggle_current_users.bind(this));
    return $('.parley div.controller-bar a.user-settings').on('click', this.toggle_user_settings.bind(this));
  };

  CommandCenter.prototype.toggle_command_center = function(e) {
    e.preventDefault();
    $('.controller-view').toggle();
    if ($('div.persistent-bar span').hasClass('entypo-down-open-mini')) {
      return $('div.persistent-bar span').removeClass('entypo-down-open-mini').addClass('entypo-up-open-mini');
    } else {
      return $('div.persistent-bar span').removeClass('entypo-up-open-mini').addClass('entypo-down-open-mini');
    }
  };

  CommandCenter.prototype.toggle_current_users = function(e) {
    var user, view, _i, _len, _ref;
    e.preventDefault();
    $('.parley div.controller-view').children().remove();
    if (this.menu !== "current_users") {
      $('.parley div.controller-view').append('<li><h1>Start Conversation</h1></li>');
      _ref = app.current_users;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        user = _ref[_i];
        view = new UserView(user, this);
        view.render();
        $('.parley div.controller-view').append(view.$element);
      }
      $('.parley div.controller-view').append(this.$add_user_bar);
      this.$element.find('.cancel').on('click', this.refresh_convo_creation.bind(this));
      return this.menu = "current_users";
    } else {
      return this.menu = null;
    }
  };

  CommandCenter.prototype.toggle_persistent_convos = function(e) {
    var convo, view, _i, _len, _ref;
    e.preventDefault();
    $(".parley div.controller-view").children().remove();
    if (this.menu !== "persistent_convos") {
      _ref = app.conversations;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        convo = _ref[_i];
        if (convo.messages.length > 0) {
          view = new PersistentConversationView(convo);
          view.render();
          $('.parley div.controller-view').append(view.$element);
        }
      }
      return this.menu = "persistent_convos";
    } else {
      return this.menu = null;
    }
  };

  CommandCenter.prototype.toggle_user_settings = function(e) {
    e.preventDefault;
    $('.parley div.controller-view').children().remove();
    if (this.menu !== "user_settings") {
      $('.parley div.controller-view').html(profile_template(app.me));
      return this.menu = "user_settings";
    } else {
      return this.menu = null;
    }
  };

  CommandCenter.prototype.confirm_new_convo_params = function(e) {
    var chat_window, conversation, convo, convo_exists, convo_id, convo_partners_image_urls, user, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _ref2;
    convo_partners_image_urls = [];
    _ref = this.new_convo_params;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      convo_partners_image_urls.push(user.image_url);
    }
    convo_id = convo_partners_image_urls.concat(app.me.image_url).sort().join();
    _ref1 = app.open_conversations;
    for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
      convo = _ref1[_j];
      if (convo_id === convo) {
        return;
      }
    }
    convo_exists = false;
    _ref2 = app.conversations;
    for (_k = 0, _len2 = _ref2.length; _k < _len2; _k++) {
      convo = _ref2[_k];
      if (convo.message_filter === convo_id) {
        convo_exists = true;
        convo = convo;
      }
    }
    if (convo_exists) {
      chat_window = new ChatRoom(convo);
      app.open_conversations.push(convo_id);
      this.new_convo_params = [];
      return this.refresh_convo_creation();
    } else {
      conversation = new Conversation(this.new_convo_params);
      chat_window = new ChatRoom(conversation);
      app.conversations.push(conversation);
      app.open_conversations.push(convo_id);
      this.new_convo_params = [];
      return this.refresh_convo_creation();
    }
  };

  CommandCenter.prototype.refresh_convo_creation = function(e) {
    var user, view, _i, _len, _ref;
    $('.parley div.controller-view').children().remove();
    $('.parley div.controller-view').append('<li><h1>Start Conversation</h1></li>');
    _ref = app.current_users;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      this.new_convo_params = [];
      view = new UserView(user, this);
      view.render();
      $('.parley div.controller-view').append(view.$element);
    }
    $('.parley div.controller-view').append(this.$add_user_bar);
    return this.$element.find('.cancel').on('click', this.refresh_convo_creation.bind(this));
  };

  return CommandCenter;

})();

module.exports = new CommandCenter();


},{"./app.coffee":19,"./chat_room_view.coffee":20,"./conversation_model.coffee":22,"./persistent_conversation_view.coffee":26,"./templates/logged_in.hbs":29,"./templates/logged_out.hbs":30,"./templates/profile.hbs":33,"./user_view.coffee":35}],22:[function(require,module,exports){
var Conversation, app;

app = require('./app.coffee');

Conversation = (function() {
  function Conversation(convo_partners, messages) {
    var first_name, i, user, _i, _len, _ref;
    this.convo_partners = convo_partners;
    this.messages = messages != null ? messages : [];
    this.generate_message_filter();
    console.log(this.message_filter);
    this.first_name_list = "";
    this.convo_partners_image_urls = [];
    _ref = this.convo_partners;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      user = _ref[i];
      first_name = user.display_name.match(/^[A-z]+/);
      if ((i + 1) !== this.convo_partners.length) {
        this.first_name_list += "" + first_name + ", ";
        this.convo_partners_image_urls.push(user.image_url);
      } else {
        this.first_name_list += "" + first_name;
        this.convo_partners_image_urls.push(user.image_url);
      }
    }
  }

  Conversation.prototype.add_message = function(message) {
    return this.messages.push(message);
  };

  Conversation.prototype.generate_message_filter = function() {
    var partner, _i, _len, _ref;
    this.message_filter = [app.me.image_url];
    _ref = this.convo_partners;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      partner = _ref[_i];
      this.message_filter.push(partner.image_url);
    }
    return this.message_filter = this.message_filter.sort().join();
  };

  return Conversation;

})();

module.exports = Conversation;


},{"./app.coffee":19}],23:[function(require,module,exports){
var Message, app;

app = require('./app.coffee');

Message = (function() {
  function Message(recipients, sender, content, image, time_stamp) {
    var id_array, user, _i, _len, _ref;
    this.recipients = recipients;
    this.sender = sender;
    this.content = content;
    this.image = image != null ? image : false;
    this.time_stamp = time_stamp;
    if (!this.time_stamp) {
      this.time_stamp = new Date().toUTCString();
    }
    id_array = [];
    _ref = this.recipients;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      user = _ref[_i];
      id_array = id_array.concat(user.image_url);
    }
    id_array = id_array.concat(this.sender.image_url);
    this.convo_id = id_array.sort().join();
    this.time_created = new Date(this.time_stamp);
    this.time_since_created = this.calculate_time();
  }

  Message.prototype.calculate_time = function() {
    var current_time, f_date, hours, minute_remainder, minutes, today;
    current_time = new Date();
    minutes = Math.floor((current_time - this.time_created) / 60000);
    if (current_time.getDate() === this.time_created.getDate() && minutes < 1440) {
      today = true;
    }
    hours = Math.floor(minutes / 60);
    minute_remainder = Math.floor(minutes % 60);
    if (minutes < 60) {
      return "" + minutes + " mins ago";
    }
    if (hours < 4) {
      if (minute_remainder === 0) {
        return "" + hours + " hours ago";
      } else {
        return "" + hours + " hour " + minute_remainder + " min ago";
      }
    } else {
      f_date = this.date_formatter();
      if (today) {
        return "" + f_date.hour + ":" + f_date.minutes + " " + f_date.suffix;
      } else {
        return "" + f_date.month + " " + f_date.day + " | " + f_date.hour + ":" + f_date.minutes + " " + f_date.suffix;
      }
    }
  };

  Message.prototype.date_formatter = function() {
    var formated, hours, minutes, new_hour, new_minutes, new_month, suffix;
    switch (this.time_created.getMonth()) {
      case 0:
        new_month = "Jan";
        break;
      case 1:
        new_month = "Feb";
        break;
      case 2:
        new_month = "Mar";
        break;
      case 3:
        new_month = "Apr";
        break;
      case 4:
        new_month = "May";
        break;
      case 5:
        new_month = "Jun";
        break;
      case 6:
        new_month = "Jul";
        break;
      case 7:
        new_month = "Aug";
        break;
      case 8:
        new_month = "Sep";
        break;
      case 9:
        new_month = "Oct";
        break;
      case 10:
        new_month = "Nov";
        break;
      case 11:
        new_month = "Dec";
    }
    hours = this.time_created.getHours();
    if (hours > 12) {
      suffix = "PM";
      new_hour = hours - 12;
    } else {
      suffix = "AM";
      new_hour = hours;
    }
    minutes = this.time_created.getMinutes();
    if (minutes < 10) {
      new_minutes = "0" + minutes;
    } else {
      new_minutes = "" + minutes;
    }
    return formated = {
      month: new_month,
      day: this.time_created.getDate(),
      hour: new_hour,
      minutes: new_minutes,
      suffix: suffix
    };
  };

  return Message;

})();

module.exports = Message;


},{"./app.coffee":19}],24:[function(require,module,exports){
var Handlebars, MessageView, app, message_template;

app = require('./app.coffee');

message_template = require('./templates/message.hbs');

Handlebars = require('hbsfy/runtime');

Handlebars.registerHelper('generate_message_content', function() {
  if (this.image) {
    return new Handlebars.SafeString("<img src='" + this.content + "'>");
  } else {
    return this.content;
  }
});

MessageView = (function() {
  function MessageView(message) {
    this.message = message;
  }

  MessageView.prototype.render = function() {
    if (this.message.sender.image_url === app.me.image_url) {
      return this.$element = $('<li class="self"></li>').append(message_template(this.message));
    } else {
      return this.$element = $('<li class="other"></li>').append(message_template(this.message));
    }
  };

  return MessageView;

})();

module.exports = MessageView;


},{"./app.coffee":19,"./templates/message.hbs":31,"hbsfy/runtime":18}],25:[function(require,module,exports){
var Message, Oauth, User, app;

app = require('./app.coffee');

User = require('./user_model.coffee');

Message = require('./message_model.coffee');

Oauth = (function() {
  function Oauth() {}

  window.sign_in_callback = function(authResult) {
    if (authResult.status.signed_in) {
      gapi.client.load('plus', 'v1', function() {
        var request;
        request = gapi.client.plus.people.get({
          'userId': 'me'
        });
        return request.execute(function(profile) {
          var display_name, image_url;
          display_name = profile.displayName;
          image_url = profile.image.url;
          app.me = new User(display_name, image_url);
          app.server.emit('join', display_name, image_url);
          return app.command_center.log_in();
        });
      });
      return Oauth.prototype.file_upload = function(file, convo_partners, convo_id) {
        return $.ajax({
          url: "https://www.googleapis.com/upload/storage/v1beta2/b/parley-images/o?uploadType=media&name=" + file.name,
          type: "POST",
          data: file,
          contentType: file.type,
          processData: false,
          headers: {
            Authorization: "Bearer " + authResult.access_token
          },
          success: (function(_this) {
            return function(res) {
              var content, convo, new_message, _i, _len, _ref, _results;
              content = "https://storage.cloud.google.com/parley-images/" + res.name;
              new_message = new Message(convo_partners, app.me, content, true);
              app.server.emit('message', new_message);
              _ref = app.conversations;
              _results = [];
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                convo = _ref[_i];
                if (convo.message_filter === convo_id) {
                  _results.push(convo.add_message(new_message));
                } else {
                  _results.push(void 0);
                }
              }
              return _results;
            };
          })(this)
        });
      };
    } else {
      return console.log("Sign-in state: " + authResult.error);
    }
  };

  return Oauth;

})();

module.exports = new Oauth();


},{"./app.coffee":19,"./message_model.coffee":23,"./user_model.coffee":34}],26:[function(require,module,exports){
var ChatRoom, Handlebars, PersistentConversationView, app, persistent_convo_reg;

app = require('./app.coffee');

ChatRoom = require('./chat_room_view.coffee');

Handlebars = require('handlebars');

persistent_convo_reg = require('./templates/persistent_convo_reg.hbs');

Handlebars = require('hbsfy/runtime');

Handlebars.registerHelper('retrieve_image', function() {
  return this.convo_partners_image_urls[0];
});

Handlebars.registerHelper('retrieve_last_message', function() {
  var file_name, last_message, trunc_message;
  last_message = this.messages[this.messages.length - 1];
  if (last_message.image) {
    file_name = last_message.content.replace(/^(https\:\/\/storage\.cloud\.google\.com\/parley-images\/)(.+)/, "$2");
    return "IMAGE MESSAGE: " + file_name;
  } else {
    trunc_message = last_message.content.slice(0, 25);
    return "" + trunc_message + "... ";
  }
});

Handlebars.registerHelper('calculate_last_message_time', function() {
  return this.messages[this.messages.length - 1].calculate_time();
});

PersistentConversationView = (function() {
  function PersistentConversationView(convo) {
    this.convo = convo;
    this.$element = $('<div class="message existing"></div>');
    this.$element.on('click', this.load_convo.bind(this));
  }

  PersistentConversationView.prototype.render = function() {
    return this.$element.html(persistent_convo_reg(this.convo));
  };

  PersistentConversationView.prototype.load_convo = function() {
    var chat_window, convo_status, open_convo, _i, _len, _ref;
    convo_status = 'closed';
    _ref = app.open_conversations;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      open_convo = _ref[_i];
      if (this.convo.message_filter === open_convo) {
        convo_status = 'open';
      }
    }
    if (convo_status !== 'open') {
      chat_window = new ChatRoom(this.convo);
      app.open_conversations.push(this.convo.message_filter);
      if (!this.$element.parent().hasClass('controller-view')) {
        return this.$element.parents('div.parley').remove();
      }
    }
  };

  return PersistentConversationView;

})();

module.exports = PersistentConversationView;


},{"./app.coffee":19,"./chat_room_view.coffee":20,"./templates/persistent_convo_reg.hbs":32,"handlebars":16,"hbsfy/runtime":18}],27:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"parley\">\n  <section class=\"conversation\">\n    <div class=\"top-bar\">\n      <a>";
  if (helper = helpers.title_bar_function) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.title_bar_function); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</a>\n      <ul class=\"message-alt\">\n        <li class=\"entypo-minus minify\"></li>\n        <li class=\"entypo-resize-full\"></li>\n        <li class=\"entypo-cancel chat-close\"></li>\n      </ul>\n    </div>\n    <div class=\"message-bar\">\n      <ul class=\"additional\">\n        <li><a class=\"entypo-user-add\"></a></li>\n      </ul>\n      <ul class=\"existing\">\n        <li><a class=\"entypo-chat\"></a></li>\n      </ul>\n    </div>\n    <ol class=\"discussion\"></ol>\n    <textarea class=\"send\" placeholder=\"Enter Message...\"></textarea>\n    <label class=\"img_upload entypo-camera\">\n      <span>\n        <input class=\"parley_file_upload\" name=\"img_upload\" type=\"file\" />\n      </span>\n     </label>\n  </section>\n</div>c";
  return buffer;
  });

},{"hbsfy/runtime":18}],28:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"avatar\">\n  <img src= ";
  if (helper = helpers.image_url) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.image_url); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + " />\n</div>\n<div class=\"content\">\n  <h2>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</h2>\n</div>\n";
  return buffer;
  });

},{"hbsfy/runtime":18}],29:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"persistent-bar\">\n  <img src=\"";
  if (helper = helpers.image_url) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.image_url); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "\" />\n  <a>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "\n    <span class=\"entypo-down-open-mini\"></span>\n  </a>\n  </div>\n<div class=\"controller-view\">\n</div>\n<div class=\"controller-bar\">\n  <ul class=\"utility-bar horizontal-list\">\n    <li>\n      <a class=\"messages\" >\n        <span class=\"entypo-chat\"></span>\n      </a>\n    </li>\n    <li>\n      <a class=\"user-settings\" >\n        <span class=\"fontawesome-cog\"></span>\n      </a>\n    </li>\n    <li>\n      <a class=\"active-users\" >\n        <span class=\"entypo-users\"></span>\n      </a>\n    </li>\n  </ul>\n</div>";
  return buffer;
  });

},{"hbsfy/runtime":18}],30:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  


  return "<div class=\"parley\">\n  <section class=\"controller\">\n      <div class=\"g-signin login-bar\"\n        data-callback=\"sign_in_callback\"\n        data-clientid=\"1027427116765-9c18ckuo07r5ms0aclbfjsmcpd3jrmtc.apps.googleusercontent.com\"\n        data-cookiepolicy=\"single_host_origin\"\n        data-theme=\"none\"\n        data-scope=\"https://www.googleapis.com/auth/plus.login https://www.googleapis.com/auth/devstorage.read_write\">\n        <li class=\"btn\">\n          <a class=\"entypo-gplus\"></a>\n        </li>\n        <li class=\"aside\">\n          <a> Sign in with google</a>\n        </li>\n      </div>\n    <div class=\"persistent-bar logged-out\">\n      <a id=\"log-click\"> click here to login!</a>\n      <span class=\"fontawesome-reorder\"></span>\n    </div>\n  </section>\n</div>";
  });

},{"hbsfy/runtime":18}],31:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"avatar\">\n  <img src="
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.sender)),stack1 == null || stack1 === false ? stack1 : stack1.image_url)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + " />\n</div>\n<div class=\"message status\">\n  <h2>"
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.sender)),stack1 == null || stack1 === false ? stack1 : stack1.display_name)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</h2>\n  <p>";
  if (helper = helpers.generate_message_content) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.generate_message_content); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</p>\n  <a class=\"time\">\n    <span class=\"entypo-clock\">   ";
  if (helper = helpers.time_since_created) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.time_since_created); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n  </a>\n</div>";
  return buffer;
  });

},{"hbsfy/runtime":18}],32:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"avatar\">\n  <img src=";
  if (helper = helpers.retrieve_image) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.retrieve_image); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + " />\n</div>\n<div class=\"content status entypo-right-open-big\">\n  <h2>"
    + escapeExpression(((stack1 = ((stack1 = (depth0 && depth0.convo_partner)),stack1 == null || stack1 === false ? stack1 : stack1.display_name)),typeof stack1 === functionType ? stack1.apply(depth0) : stack1))
    + "</h2>\n  <p>";
  if (helper = helpers.retrieve_last_message) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.retrieve_last_message); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</p>\n  <a class=\"time\">\n    <span class=\"entypo-clock\"> ";
  if (helper = helpers.calculate_last_message_time) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.calculate_last_message_time); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</span>\n  </a>\n</div>\n";
  return buffer;
  });

},{"hbsfy/runtime":18}],33:[function(require,module,exports){
// hbsfy compiled Handlebars template
var Handlebars = require('hbsfy/runtime');
module.exports = Handlebars.template(function (Handlebars,depth0,helpers,partials,data) {
  this.compilerInfo = [4,'>= 1.0.0'];
helpers = this.merge(helpers, Handlebars.helpers); data = data || {};
  var buffer = "", stack1, helper, functionType="function", escapeExpression=this.escapeExpression;


  buffer += "<div class=\"default-view\">\n  <figure>\n    <img src=";
  if (helper = helpers.image_url) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.image_url); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + " />\n    <h2>";
  if (helper = helpers.display_name) { stack1 = helper.call(depth0, {hash:{},data:data}); }
  else { helper = (depth0 && depth0.display_name); stack1 = typeof helper === functionType ? helper.call(depth0, {hash:{},data:data}) : helper; }
  buffer += escapeExpression(stack1)
    + "</h2>\n  </figure>\n</div>";
  return buffer;
  });

},{"hbsfy/runtime":18}],34:[function(require,module,exports){
var User, app;

app = require('./app.coffee');

User = (function() {
  function User(display_name, image_url) {
    this.display_name = display_name;
    this.image_url = image_url;
    this.status = "active";
  }

  return User;

})();

module.exports = User;


},{"./app.coffee":19}],35:[function(require,module,exports){
var ChatRoom, Conversation, UserView, app, current_user_template;

app = require('./app.coffee');

ChatRoom = require('./chat_room_view.coffee');

Conversation = require('./conversation_model.coffee');

current_user_template = require('./templates/current_user.hbs');

UserView = (function() {
  function UserView(current_user, current_view) {
    this.current_user = current_user;
    this.current_view = current_view;
    this.$element = $("<li class='user'></li>");
    this.$element.on('click', this.user_interact_callback.bind(this));
  }

  UserView.prototype.render = function() {
    return this.$element.html(current_user_template(this.current_user));
  };

  UserView.prototype.user_interact_callback = function() {
    var new_params, user, _i, _len, _ref;
    if (this.$element.hasClass('user-selected')) {
      new_params = [];
      _ref = this.current_view.new_convo_params;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        user = _ref[_i];
        if (user.image_url !== this.current_user.image_url) {
          new_params.push(user);
        }
      }
      this.current_view.new_convo_params = new_params;
      this.$element.removeClass('user-selected');
    } else {
      this.current_view.new_convo_params.push(this.current_user);
      this.$element.addClass('user-selected');
    }
    console.log(this.current_view.new_convo_params);
    if (this.current_view.new_convo_params.length > 0) {
      return this.current_view.$element.find('.confirm').removeClass('disabled').on('click', this.current_view.confirm_new_convo_params.bind(this.current_view));
    } else {
      return this.current_view.$element.find('.confirm').addClass('disabled').off();
    }
  };

  return UserView;

})();

module.exports = UserView;


},{"./app.coffee":19,"./chat_room_view.coffee":20,"./conversation_model.coffee":22,"./templates/current_user.hbs":28}]},{},[19])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L2xpYi9fZW1wdHkuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMucnVudGltZS5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9iYXNlLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2FzdC5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9iYXNlLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL2phdmFzY3JpcHQtY29tcGlsZXIuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvcGFyc2VyLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3ByaW50ZXIuanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvY29tcGlsZXIvdmlzaXRvci5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9leGNlcHRpb24uanMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL25vZGVfbW9kdWxlcy9oYW5kbGViYXJzL2Rpc3QvY2pzL2hhbmRsZWJhcnMvcnVudGltZS5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy9zYWZlLXN0cmluZy5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvZGlzdC9janMvaGFuZGxlYmFycy91dGlscy5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvbm9kZV9tb2R1bGVzL2hhbmRsZWJhcnMvbGliL2luZGV4LmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGFuZGxlYmFycy9ydW50aW1lLmpzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9ub2RlX21vZHVsZXMvaGJzZnkvcnVudGltZS5qcyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL2FwcC5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9jaGF0X3Jvb21fdmlldy5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9jb21tYW5kX2NlbnRlcl92aWV3LmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL2NvbnZlcnNhdGlvbl9tb2RlbC5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9tZXNzYWdlX21vZGVsLmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL21lc3NhZ2Vfdmlldy5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9vYXV0aC5jb2ZmZWUiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy9wZXJzaXN0ZW50X2NvbnZlcnNhdGlvbl92aWV3LmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9jaGF0X3Jvb20uaGJzIiwiL1VzZXJzL2pvc2VwaGNoYXBwZWxsL3BhcmxleS5qcy9zcmMvdGVtcGxhdGVzL2N1cnJlbnRfdXNlci5oYnMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy90ZW1wbGF0ZXMvbG9nZ2VkX2luLmhicyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9sb2dnZWRfb3V0LmhicyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9tZXNzYWdlLmhicyIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3RlbXBsYXRlcy9wZXJzaXN0ZW50X2NvbnZvX3JlZy5oYnMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy90ZW1wbGF0ZXMvcHJvZmlsZS5oYnMiLCIvVXNlcnMvam9zZXBoY2hhcHBlbGwvcGFybGV5LmpzL3NyYy91c2VyX21vZGVsLmNvZmZlZSIsIi9Vc2Vycy9qb3NlcGhjaGFwcGVsbC9wYXJsZXkuanMvc3JjL3VzZXJfdmlldy5jb2ZmZWUiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25MQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xPQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3NkJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3plQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNYQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7O0FDSEE7QUFDQTs7QUNEQSxJQUFBLHVFQUFBOztBQUFBLE1BQUEsR0FBUyxFQUFULENBQUE7O0FBQUEsTUFDTSxDQUFDLE9BQVAsR0FBaUIsTUFEakIsQ0FBQTs7QUFLQTtBQUFBLDJDQUxBOztBQUFBO0FBYWUsRUFBQSxhQUFBLEdBQUE7QUFDWCxJQUFBLElBQUMsQ0FBQSxh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Q0FBbUIsZUFBbkIsQ0FEQSxDQVJGO0tBQUE7QUFBQSxJQVdBLE9BQU8sQ0FBQyxHQUFSLENBQVksSUFBQyxDQUFBLFlBQVksQ0FBQyxnQkFBMUIsQ0FYQSxDQUFBO0FBYUEsSUFBQSxJQUFHLElBQUMsQ0FBQSxZQUFZLENBQUMsZ0JBQWdCLENBQUMsTUFBL0IsR0FBd0MsQ0FBM0M7YUFDRSxJQUFDLENBQUEsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUF2QixDQUE0QixVQUE1QixDQUF1QyxDQUFDLFdBQXhDLENBQW9ELFVBQXBELENBQ0EsQ0FBQyxFQURELENBQ0ksT0FESixFQUNhLElBQUMsQ0FBQSxZQUFZLENBQUMsd0JBQXdCLENBQUMsSUFBdkMsQ0FBNEMsSUFBQyxDQUFBLFlBQTdDLENBRGIsRUFERjtLQUFBLE1BQUE7YUFJRSxJQUFDLENBQUEsWUFBWSxDQUFDLFFBQVEsQ0FBQyxJQUF2QixDQUE0QixVQUE1QixDQUF1QyxDQUFDLFFBQXhDLENBQWlELFVBQWpELENBQTRELENBQUMsR0FBN0QsQ0FBQSxFQUpGO0tBZm9CO0VBQUEsQ0FQeEIsQ0FBQTs7a0JBQUE7O0lBVkYsQ0FBQTs7QUFBQSxNQTRETSxDQUFDLE9BQVAsR0FBaUIsUUE1RGpCLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsbnVsbCwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmdsb2JhbHMgSGFuZGxlYmFyczogdHJ1ZSAqL1xudmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzLnJ1bnRpbWVcIilbXCJkZWZhdWx0XCJdO1xuXG4vLyBDb21waWxlciBpbXBvcnRzXG52YXIgQVNUID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9jb21waWxlci9hc3RcIilbXCJkZWZhdWx0XCJdO1xudmFyIFBhcnNlciA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvYmFzZVwiKS5wYXJzZXI7XG52YXIgcGFyc2UgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2Jhc2VcIikucGFyc2U7XG52YXIgQ29tcGlsZXIgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyXCIpLkNvbXBpbGVyO1xudmFyIGNvbXBpbGUgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2NvbXBpbGVyXCIpLmNvbXBpbGU7XG52YXIgcHJlY29tcGlsZSA9IHJlcXVpcmUoXCIuL2hhbmRsZWJhcnMvY29tcGlsZXIvY29tcGlsZXJcIikucHJlY29tcGlsZTtcbnZhciBKYXZhU2NyaXB0Q29tcGlsZXIgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2NvbXBpbGVyL2phdmFzY3JpcHQtY29tcGlsZXJcIilbXCJkZWZhdWx0XCJdO1xuXG52YXIgX2NyZWF0ZSA9IEhhbmRsZWJhcnMuY3JlYXRlO1xudmFyIGNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaGIgPSBfY3JlYXRlKCk7XG5cbiAgaGIuY29tcGlsZSA9IGZ1bmN0aW9uKGlucHV0LCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIGNvbXBpbGUoaW5wdXQsIG9wdGlvbnMsIGhiKTtcbiAgfTtcbiAgaGIucHJlY29tcGlsZSA9IGZ1bmN0aW9uIChpbnB1dCwgb3B0aW9ucykge1xuICAgIHJldHVybiBwcmVjb21waWxlKGlucHV0LCBvcHRpb25zLCBoYik7XG4gIH07XG5cbiAgaGIuQVNUID0gQVNUO1xuICBoYi5Db21waWxlciA9IENvbXBpbGVyO1xuICBoYi5KYXZhU2NyaXB0Q29tcGlsZXIgPSBKYXZhU2NyaXB0Q29tcGlsZXI7XG4gIGhiLlBhcnNlciA9IFBhcnNlcjtcbiAgaGIucGFyc2UgPSBwYXJzZTtcblxuICByZXR1cm4gaGI7XG59O1xuXG5IYW5kbGViYXJzID0gY3JlYXRlKCk7XG5IYW5kbGViYXJzLmNyZWF0ZSA9IGNyZWF0ZTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBIYW5kbGViYXJzOyIsIlwidXNlIHN0cmljdFwiO1xuLypnbG9iYWxzIEhhbmRsZWJhcnM6IHRydWUgKi9cbnZhciBiYXNlID0gcmVxdWlyZShcIi4vaGFuZGxlYmFycy9iYXNlXCIpO1xuXG4vLyBFYWNoIG9mIHRoZXNlIGF1Z21lbnQgdGhlIEhhbmRsZWJhcnMgb2JqZWN0LiBObyBuZWVkIHRvIHNldHVwIGhlcmUuXG4vLyAoVGhpcyBpcyBkb25lIHRvIGVhc2lseSBzaGFyZSBjb2RlIGJldHdlZW4gY29tbW9uanMgYW5kIGJyb3dzZSBlbnZzKVxudmFyIFNhZmVTdHJpbmcgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3NhZmUtc3RyaW5nXCIpW1wiZGVmYXVsdFwiXTtcbnZhciBFeGNlcHRpb24gPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG52YXIgVXRpbHMgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3V0aWxzXCIpO1xudmFyIHJ1bnRpbWUgPSByZXF1aXJlKFwiLi9oYW5kbGViYXJzL3J1bnRpbWVcIik7XG5cbi8vIEZvciBjb21wYXRpYmlsaXR5IGFuZCB1c2FnZSBvdXRzaWRlIG9mIG1vZHVsZSBzeXN0ZW1zLCBtYWtlIHRoZSBIYW5kbGViYXJzIG9iamVjdCBhIG5hbWVzcGFjZVxudmFyIGNyZWF0ZSA9IGZ1bmN0aW9uKCkge1xuICB2YXIgaGIgPSBuZXcgYmFzZS5IYW5kbGViYXJzRW52aXJvbm1lbnQoKTtcblxuICBVdGlscy5leHRlbmQoaGIsIGJhc2UpO1xuICBoYi5TYWZlU3RyaW5nID0gU2FmZVN0cmluZztcbiAgaGIuRXhjZXB0aW9uID0gRXhjZXB0aW9uO1xuICBoYi5VdGlscyA9IFV0aWxzO1xuXG4gIGhiLlZNID0gcnVudGltZTtcbiAgaGIudGVtcGxhdGUgPSBmdW5jdGlvbihzcGVjKSB7XG4gICAgcmV0dXJuIHJ1bnRpbWUudGVtcGxhdGUoc3BlYywgaGIpO1xuICB9O1xuXG4gIHJldHVybiBoYjtcbn07XG5cbnZhciBIYW5kbGViYXJzID0gY3JlYXRlKCk7XG5IYW5kbGViYXJzLmNyZWF0ZSA9IGNyZWF0ZTtcblxuZXhwb3J0c1tcImRlZmF1bHRcIl0gPSBIYW5kbGViYXJzOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFV0aWxzID0gcmVxdWlyZShcIi4vdXRpbHNcIik7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4vZXhjZXB0aW9uXCIpW1wiZGVmYXVsdFwiXTtcblxudmFyIFZFUlNJT04gPSBcIjEuMy4wXCI7XG5leHBvcnRzLlZFUlNJT04gPSBWRVJTSU9OO3ZhciBDT01QSUxFUl9SRVZJU0lPTiA9IDQ7XG5leHBvcnRzLkNPTVBJTEVSX1JFVklTSU9OID0gQ09NUElMRVJfUkVWSVNJT047XG52YXIgUkVWSVNJT05fQ0hBTkdFUyA9IHtcbiAgMTogJzw9IDEuMC5yYy4yJywgLy8gMS4wLnJjLjIgaXMgYWN0dWFsbHkgcmV2MiBidXQgZG9lc24ndCByZXBvcnQgaXRcbiAgMjogJz09IDEuMC4wLXJjLjMnLFxuICAzOiAnPT0gMS4wLjAtcmMuNCcsXG4gIDQ6ICc+PSAxLjAuMCdcbn07XG5leHBvcnRzLlJFVklTSU9OX0NIQU5HRVMgPSBSRVZJU0lPTl9DSEFOR0VTO1xudmFyIGlzQXJyYXkgPSBVdGlscy5pc0FycmF5LFxuICAgIGlzRnVuY3Rpb24gPSBVdGlscy5pc0Z1bmN0aW9uLFxuICAgIHRvU3RyaW5nID0gVXRpbHMudG9TdHJpbmcsXG4gICAgb2JqZWN0VHlwZSA9ICdbb2JqZWN0IE9iamVjdF0nO1xuXG5mdW5jdGlvbiBIYW5kbGViYXJzRW52aXJvbm1lbnQoaGVscGVycywgcGFydGlhbHMpIHtcbiAgdGhpcy5oZWxwZXJzID0gaGVscGVycyB8fCB7fTtcbiAgdGhpcy5wYXJ0aWFscyA9IHBhcnRpYWxzIHx8IHt9O1xuXG4gIHJlZ2lzdGVyRGVmYXVsdEhlbHBlcnModGhpcyk7XG59XG5cbmV4cG9ydHMuSGFuZGxlYmFyc0Vudmlyb25tZW50ID0gSGFuZGxlYmFyc0Vudmlyb25tZW50O0hhbmRsZWJhcnNFbnZpcm9ubWVudC5wcm90b3R5cGUgPSB7XG4gIGNvbnN0cnVjdG9yOiBIYW5kbGViYXJzRW52aXJvbm1lbnQsXG5cbiAgbG9nZ2VyOiBsb2dnZXIsXG4gIGxvZzogbG9nLFxuXG4gIHJlZ2lzdGVySGVscGVyOiBmdW5jdGlvbihuYW1lLCBmbiwgaW52ZXJzZSkge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgICBpZiAoaW52ZXJzZSB8fCBmbikgeyB0aHJvdyBuZXcgRXhjZXB0aW9uKCdBcmcgbm90IHN1cHBvcnRlZCB3aXRoIG11bHRpcGxlIGhlbHBlcnMnKTsgfVxuICAgICAgVXRpbHMuZXh0ZW5kKHRoaXMuaGVscGVycywgbmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpbnZlcnNlKSB7IGZuLm5vdCA9IGludmVyc2U7IH1cbiAgICAgIHRoaXMuaGVscGVyc1tuYW1lXSA9IGZuO1xuICAgIH1cbiAgfSxcblxuICByZWdpc3RlclBhcnRpYWw6IGZ1bmN0aW9uKG5hbWUsIHN0cikge1xuICAgIGlmICh0b1N0cmluZy5jYWxsKG5hbWUpID09PSBvYmplY3RUeXBlKSB7XG4gICAgICBVdGlscy5leHRlbmQodGhpcy5wYXJ0aWFscywgIG5hbWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBhcnRpYWxzW25hbWVdID0gc3RyO1xuICAgIH1cbiAgfVxufTtcblxuZnVuY3Rpb24gcmVnaXN0ZXJEZWZhdWx0SGVscGVycyhpbnN0YW5jZSkge1xuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignaGVscGVyTWlzc2luZycsIGZ1bmN0aW9uKGFyZykge1xuICAgIGlmKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJNaXNzaW5nIGhlbHBlcjogJ1wiICsgYXJnICsgXCInXCIpO1xuICAgIH1cbiAgfSk7XG5cbiAgaW5zdGFuY2UucmVnaXN0ZXJIZWxwZXIoJ2Jsb2NrSGVscGVyTWlzc2luZycsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgaW52ZXJzZSA9IG9wdGlvbnMuaW52ZXJzZSB8fCBmdW5jdGlvbigpIHt9LCBmbiA9IG9wdGlvbnMuZm47XG5cbiAgICBpZiAoaXNGdW5jdGlvbihjb250ZXh0KSkgeyBjb250ZXh0ID0gY29udGV4dC5jYWxsKHRoaXMpOyB9XG5cbiAgICBpZihjb250ZXh0ID09PSB0cnVlKSB7XG4gICAgICByZXR1cm4gZm4odGhpcyk7XG4gICAgfSBlbHNlIGlmKGNvbnRleHQgPT09IGZhbHNlIHx8IGNvbnRleHQgPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGludmVyc2UodGhpcyk7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KGNvbnRleHQpKSB7XG4gICAgICBpZihjb250ZXh0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgcmV0dXJuIGluc3RhbmNlLmhlbHBlcnMuZWFjaChjb250ZXh0LCBvcHRpb25zKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBpbnZlcnNlKHRoaXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gZm4oY29udGV4dCk7XG4gICAgfVxuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcignZWFjaCcsIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICB2YXIgZm4gPSBvcHRpb25zLmZuLCBpbnZlcnNlID0gb3B0aW9ucy5pbnZlcnNlO1xuICAgIHZhciBpID0gMCwgcmV0ID0gXCJcIiwgZGF0YTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGNvbnRleHQpKSB7IGNvbnRleHQgPSBjb250ZXh0LmNhbGwodGhpcyk7IH1cblxuICAgIGlmIChvcHRpb25zLmRhdGEpIHtcbiAgICAgIGRhdGEgPSBjcmVhdGVGcmFtZShvcHRpb25zLmRhdGEpO1xuICAgIH1cblxuICAgIGlmKGNvbnRleHQgJiYgdHlwZW9mIGNvbnRleHQgPT09ICdvYmplY3QnKSB7XG4gICAgICBpZiAoaXNBcnJheShjb250ZXh0KSkge1xuICAgICAgICBmb3IodmFyIGogPSBjb250ZXh0Lmxlbmd0aDsgaTxqOyBpKyspIHtcbiAgICAgICAgICBpZiAoZGF0YSkge1xuICAgICAgICAgICAgZGF0YS5pbmRleCA9IGk7XG4gICAgICAgICAgICBkYXRhLmZpcnN0ID0gKGkgPT09IDApO1xuICAgICAgICAgICAgZGF0YS5sYXN0ICA9IChpID09PSAoY29udGV4dC5sZW5ndGgtMSkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXQgPSByZXQgKyBmbihjb250ZXh0W2ldLCB7IGRhdGE6IGRhdGEgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZvcih2YXIga2V5IGluIGNvbnRleHQpIHtcbiAgICAgICAgICBpZihjb250ZXh0Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgIGlmKGRhdGEpIHsgXG4gICAgICAgICAgICAgIGRhdGEua2V5ID0ga2V5OyBcbiAgICAgICAgICAgICAgZGF0YS5pbmRleCA9IGk7XG4gICAgICAgICAgICAgIGRhdGEuZmlyc3QgPSAoaSA9PT0gMCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXQgPSByZXQgKyBmbihjb250ZXh0W2tleV0sIHtkYXRhOiBkYXRhfSk7XG4gICAgICAgICAgICBpKys7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoaSA9PT0gMCl7XG4gICAgICByZXQgPSBpbnZlcnNlKHRoaXMpO1xuICAgIH1cblxuICAgIHJldHVybiByZXQ7XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdpZicsIGZ1bmN0aW9uKGNvbmRpdGlvbmFsLCBvcHRpb25zKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24oY29uZGl0aW9uYWwpKSB7IGNvbmRpdGlvbmFsID0gY29uZGl0aW9uYWwuY2FsbCh0aGlzKTsgfVxuXG4gICAgLy8gRGVmYXVsdCBiZWhhdmlvciBpcyB0byByZW5kZXIgdGhlIHBvc2l0aXZlIHBhdGggaWYgdGhlIHZhbHVlIGlzIHRydXRoeSBhbmQgbm90IGVtcHR5LlxuICAgIC8vIFRoZSBgaW5jbHVkZVplcm9gIG9wdGlvbiBtYXkgYmUgc2V0IHRvIHRyZWF0IHRoZSBjb25kdGlvbmFsIGFzIHB1cmVseSBub3QgZW1wdHkgYmFzZWQgb24gdGhlXG4gICAgLy8gYmVoYXZpb3Igb2YgaXNFbXB0eS4gRWZmZWN0aXZlbHkgdGhpcyBkZXRlcm1pbmVzIGlmIDAgaXMgaGFuZGxlZCBieSB0aGUgcG9zaXRpdmUgcGF0aCBvciBuZWdhdGl2ZS5cbiAgICBpZiAoKCFvcHRpb25zLmhhc2guaW5jbHVkZVplcm8gJiYgIWNvbmRpdGlvbmFsKSB8fCBVdGlscy5pc0VtcHR5KGNvbmRpdGlvbmFsKSkge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuaW52ZXJzZSh0aGlzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG9wdGlvbnMuZm4odGhpcyk7XG4gICAgfVxuICB9KTtcblxuICBpbnN0YW5jZS5yZWdpc3RlckhlbHBlcigndW5sZXNzJywgZnVuY3Rpb24oY29uZGl0aW9uYWwsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gaW5zdGFuY2UuaGVscGVyc1snaWYnXS5jYWxsKHRoaXMsIGNvbmRpdGlvbmFsLCB7Zm46IG9wdGlvbnMuaW52ZXJzZSwgaW52ZXJzZTogb3B0aW9ucy5mbiwgaGFzaDogb3B0aW9ucy5oYXNofSk7XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCd3aXRoJywgZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIGlmIChpc0Z1bmN0aW9uKGNvbnRleHQpKSB7IGNvbnRleHQgPSBjb250ZXh0LmNhbGwodGhpcyk7IH1cblxuICAgIGlmICghVXRpbHMuaXNFbXB0eShjb250ZXh0KSkgcmV0dXJuIG9wdGlvbnMuZm4oY29udGV4dCk7XG4gIH0pO1xuXG4gIGluc3RhbmNlLnJlZ2lzdGVySGVscGVyKCdsb2cnLCBmdW5jdGlvbihjb250ZXh0LCBvcHRpb25zKSB7XG4gICAgdmFyIGxldmVsID0gb3B0aW9ucy5kYXRhICYmIG9wdGlvbnMuZGF0YS5sZXZlbCAhPSBudWxsID8gcGFyc2VJbnQob3B0aW9ucy5kYXRhLmxldmVsLCAxMCkgOiAxO1xuICAgIGluc3RhbmNlLmxvZyhsZXZlbCwgY29udGV4dCk7XG4gIH0pO1xufVxuXG52YXIgbG9nZ2VyID0ge1xuICBtZXRob2RNYXA6IHsgMDogJ2RlYnVnJywgMTogJ2luZm8nLCAyOiAnd2FybicsIDM6ICdlcnJvcicgfSxcblxuICAvLyBTdGF0ZSBlbnVtXG4gIERFQlVHOiAwLFxuICBJTkZPOiAxLFxuICBXQVJOOiAyLFxuICBFUlJPUjogMyxcbiAgbGV2ZWw6IDMsXG5cbiAgLy8gY2FuIGJlIG92ZXJyaWRkZW4gaW4gdGhlIGhvc3QgZW52aXJvbm1lbnRcbiAgbG9nOiBmdW5jdGlvbihsZXZlbCwgb2JqKSB7XG4gICAgaWYgKGxvZ2dlci5sZXZlbCA8PSBsZXZlbCkge1xuICAgICAgdmFyIG1ldGhvZCA9IGxvZ2dlci5tZXRob2RNYXBbbGV2ZWxdO1xuICAgICAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSAndW5kZWZpbmVkJyAmJiBjb25zb2xlW21ldGhvZF0pIHtcbiAgICAgICAgY29uc29sZVttZXRob2RdLmNhbGwoY29uc29sZSwgb2JqKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn07XG5leHBvcnRzLmxvZ2dlciA9IGxvZ2dlcjtcbmZ1bmN0aW9uIGxvZyhsZXZlbCwgb2JqKSB7IGxvZ2dlci5sb2cobGV2ZWwsIG9iaik7IH1cblxuZXhwb3J0cy5sb2cgPSBsb2c7dmFyIGNyZWF0ZUZyYW1lID0gZnVuY3Rpb24ob2JqZWN0KSB7XG4gIHZhciBvYmogPSB7fTtcbiAgVXRpbHMuZXh0ZW5kKG9iaiwgb2JqZWN0KTtcbiAgcmV0dXJuIG9iajtcbn07XG5leHBvcnRzLmNyZWF0ZUZyYW1lID0gY3JlYXRlRnJhbWU7IiwiXCJ1c2Ugc3RyaWN0XCI7XG52YXIgRXhjZXB0aW9uID0gcmVxdWlyZShcIi4uL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG5cbmZ1bmN0aW9uIExvY2F0aW9uSW5mbyhsb2NJbmZvKXtcbiAgbG9jSW5mbyA9IGxvY0luZm8gfHwge307XG4gIHRoaXMuZmlyc3RMaW5lICAgPSBsb2NJbmZvLmZpcnN0X2xpbmU7XG4gIHRoaXMuZmlyc3RDb2x1bW4gPSBsb2NJbmZvLmZpcnN0X2NvbHVtbjtcbiAgdGhpcy5sYXN0Q29sdW1uICA9IGxvY0luZm8ubGFzdF9jb2x1bW47XG4gIHRoaXMubGFzdExpbmUgICAgPSBsb2NJbmZvLmxhc3RfbGluZTtcbn1cblxudmFyIEFTVCA9IHtcbiAgUHJvZ3JhbU5vZGU6IGZ1bmN0aW9uKHN0YXRlbWVudHMsIGludmVyc2VTdHJpcCwgaW52ZXJzZSwgbG9jSW5mbykge1xuICAgIHZhciBpbnZlcnNlTG9jYXRpb25JbmZvLCBmaXJzdEludmVyc2VOb2RlO1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAzKSB7XG4gICAgICBsb2NJbmZvID0gaW52ZXJzZTtcbiAgICAgIGludmVyc2UgPSBudWxsO1xuICAgIH0gZWxzZSBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMikge1xuICAgICAgbG9jSW5mbyA9IGludmVyc2VTdHJpcDtcbiAgICAgIGludmVyc2VTdHJpcCA9IG51bGw7XG4gICAgfVxuXG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJwcm9ncmFtXCI7XG4gICAgdGhpcy5zdGF0ZW1lbnRzID0gc3RhdGVtZW50cztcbiAgICB0aGlzLnN0cmlwID0ge307XG5cbiAgICBpZihpbnZlcnNlKSB7XG4gICAgICBmaXJzdEludmVyc2VOb2RlID0gaW52ZXJzZVswXTtcbiAgICAgIGlmIChmaXJzdEludmVyc2VOb2RlKSB7XG4gICAgICAgIGludmVyc2VMb2NhdGlvbkluZm8gPSB7XG4gICAgICAgICAgZmlyc3RfbGluZTogZmlyc3RJbnZlcnNlTm9kZS5maXJzdExpbmUsXG4gICAgICAgICAgbGFzdF9saW5lOiBmaXJzdEludmVyc2VOb2RlLmxhc3RMaW5lLFxuICAgICAgICAgIGxhc3RfY29sdW1uOiBmaXJzdEludmVyc2VOb2RlLmxhc3RDb2x1bW4sXG4gICAgICAgICAgZmlyc3RfY29sdW1uOiBmaXJzdEludmVyc2VOb2RlLmZpcnN0Q29sdW1uXG4gICAgICAgIH07XG4gICAgICAgIHRoaXMuaW52ZXJzZSA9IG5ldyBBU1QuUHJvZ3JhbU5vZGUoaW52ZXJzZSwgaW52ZXJzZVN0cmlwLCBpbnZlcnNlTG9jYXRpb25JbmZvKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuaW52ZXJzZSA9IG5ldyBBU1QuUHJvZ3JhbU5vZGUoaW52ZXJzZSwgaW52ZXJzZVN0cmlwKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuc3RyaXAucmlnaHQgPSBpbnZlcnNlU3RyaXAubGVmdDtcbiAgICB9IGVsc2UgaWYgKGludmVyc2VTdHJpcCkge1xuICAgICAgdGhpcy5zdHJpcC5sZWZ0ID0gaW52ZXJzZVN0cmlwLnJpZ2h0O1xuICAgIH1cbiAgfSxcblxuICBNdXN0YWNoZU5vZGU6IGZ1bmN0aW9uKHJhd1BhcmFtcywgaGFzaCwgb3Blbiwgc3RyaXAsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIm11c3RhY2hlXCI7XG4gICAgdGhpcy5zdHJpcCA9IHN0cmlwO1xuXG4gICAgLy8gT3BlbiBtYXkgYmUgYSBzdHJpbmcgcGFyc2VkIGZyb20gdGhlIHBhcnNlciBvciBhIHBhc3NlZCBib29sZWFuIGZsYWdcbiAgICBpZiAob3BlbiAhPSBudWxsICYmIG9wZW4uY2hhckF0KSB7XG4gICAgICAvLyBNdXN0IHVzZSBjaGFyQXQgdG8gc3VwcG9ydCBJRSBwcmUtMTBcbiAgICAgIHZhciBlc2NhcGVGbGFnID0gb3Blbi5jaGFyQXQoMykgfHwgb3Blbi5jaGFyQXQoMik7XG4gICAgICB0aGlzLmVzY2FwZWQgPSBlc2NhcGVGbGFnICE9PSAneycgJiYgZXNjYXBlRmxhZyAhPT0gJyYnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVzY2FwZWQgPSAhIW9wZW47XG4gICAgfVxuXG4gICAgaWYgKHJhd1BhcmFtcyBpbnN0YW5jZW9mIEFTVC5TZXhwck5vZGUpIHtcbiAgICAgIHRoaXMuc2V4cHIgPSByYXdQYXJhbXM7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFN1cHBvcnQgb2xkIEFTVCBBUElcbiAgICAgIHRoaXMuc2V4cHIgPSBuZXcgQVNULlNleHByTm9kZShyYXdQYXJhbXMsIGhhc2gpO1xuICAgIH1cblxuICAgIHRoaXMuc2V4cHIuaXNSb290ID0gdHJ1ZTtcblxuICAgIC8vIFN1cHBvcnQgb2xkIEFTVCBBUEkgdGhhdCBzdG9yZWQgdGhpcyBpbmZvIGluIE11c3RhY2hlTm9kZVxuICAgIHRoaXMuaWQgPSB0aGlzLnNleHByLmlkO1xuICAgIHRoaXMucGFyYW1zID0gdGhpcy5zZXhwci5wYXJhbXM7XG4gICAgdGhpcy5oYXNoID0gdGhpcy5zZXhwci5oYXNoO1xuICAgIHRoaXMuZWxpZ2libGVIZWxwZXIgPSB0aGlzLnNleHByLmVsaWdpYmxlSGVscGVyO1xuICAgIHRoaXMuaXNIZWxwZXIgPSB0aGlzLnNleHByLmlzSGVscGVyO1xuICB9LFxuXG4gIFNleHByTm9kZTogZnVuY3Rpb24ocmF3UGFyYW1zLCBoYXNoLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG5cbiAgICB0aGlzLnR5cGUgPSBcInNleHByXCI7XG4gICAgdGhpcy5oYXNoID0gaGFzaDtcblxuICAgIHZhciBpZCA9IHRoaXMuaWQgPSByYXdQYXJhbXNbMF07XG4gICAgdmFyIHBhcmFtcyA9IHRoaXMucGFyYW1zID0gcmF3UGFyYW1zLnNsaWNlKDEpO1xuXG4gICAgLy8gYSBtdXN0YWNoZSBpcyBhbiBlbGlnaWJsZSBoZWxwZXIgaWY6XG4gICAgLy8gKiBpdHMgaWQgaXMgc2ltcGxlIChhIHNpbmdsZSBwYXJ0LCBub3QgYHRoaXNgIG9yIGAuLmApXG4gICAgdmFyIGVsaWdpYmxlSGVscGVyID0gdGhpcy5lbGlnaWJsZUhlbHBlciA9IGlkLmlzU2ltcGxlO1xuXG4gICAgLy8gYSBtdXN0YWNoZSBpcyBkZWZpbml0ZWx5IGEgaGVscGVyIGlmOlxuICAgIC8vICogaXQgaXMgYW4gZWxpZ2libGUgaGVscGVyLCBhbmRcbiAgICAvLyAqIGl0IGhhcyBhdCBsZWFzdCBvbmUgcGFyYW1ldGVyIG9yIGhhc2ggc2VnbWVudFxuICAgIHRoaXMuaXNIZWxwZXIgPSBlbGlnaWJsZUhlbHBlciAmJiAocGFyYW1zLmxlbmd0aCB8fCBoYXNoKTtcblxuICAgIC8vIGlmIGEgbXVzdGFjaGUgaXMgYW4gZWxpZ2libGUgaGVscGVyIGJ1dCBub3QgYSBkZWZpbml0ZVxuICAgIC8vIGhlbHBlciwgaXQgaXMgYW1iaWd1b3VzLCBhbmQgd2lsbCBiZSByZXNvbHZlZCBpbiBhIGxhdGVyXG4gICAgLy8gcGFzcyBvciBhdCBydW50aW1lLlxuICB9LFxuXG4gIFBhcnRpYWxOb2RlOiBmdW5jdGlvbihwYXJ0aWFsTmFtZSwgY29udGV4dCwgc3RyaXAsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgICAgICAgICA9IFwicGFydGlhbFwiO1xuICAgIHRoaXMucGFydGlhbE5hbWUgID0gcGFydGlhbE5hbWU7XG4gICAgdGhpcy5jb250ZXh0ICAgICAgPSBjb250ZXh0O1xuICAgIHRoaXMuc3RyaXAgPSBzdHJpcDtcbiAgfSxcblxuICBCbG9ja05vZGU6IGZ1bmN0aW9uKG11c3RhY2hlLCBwcm9ncmFtLCBpbnZlcnNlLCBjbG9zZSwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuXG4gICAgaWYobXVzdGFjaGUuc2V4cHIuaWQub3JpZ2luYWwgIT09IGNsb3NlLnBhdGgub3JpZ2luYWwpIHtcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24obXVzdGFjaGUuc2V4cHIuaWQub3JpZ2luYWwgKyBcIiBkb2Vzbid0IG1hdGNoIFwiICsgY2xvc2UucGF0aC5vcmlnaW5hbCwgdGhpcyk7XG4gICAgfVxuXG4gICAgdGhpcy50eXBlID0gJ2Jsb2NrJztcbiAgICB0aGlzLm11c3RhY2hlID0gbXVzdGFjaGU7XG4gICAgdGhpcy5wcm9ncmFtICA9IHByb2dyYW07XG4gICAgdGhpcy5pbnZlcnNlICA9IGludmVyc2U7XG5cbiAgICB0aGlzLnN0cmlwID0ge1xuICAgICAgbGVmdDogbXVzdGFjaGUuc3RyaXAubGVmdCxcbiAgICAgIHJpZ2h0OiBjbG9zZS5zdHJpcC5yaWdodFxuICAgIH07XG5cbiAgICAocHJvZ3JhbSB8fCBpbnZlcnNlKS5zdHJpcC5sZWZ0ID0gbXVzdGFjaGUuc3RyaXAucmlnaHQ7XG4gICAgKGludmVyc2UgfHwgcHJvZ3JhbSkuc3RyaXAucmlnaHQgPSBjbG9zZS5zdHJpcC5sZWZ0O1xuXG4gICAgaWYgKGludmVyc2UgJiYgIXByb2dyYW0pIHtcbiAgICAgIHRoaXMuaXNJbnZlcnNlID0gdHJ1ZTtcbiAgICB9XG4gIH0sXG5cbiAgQ29udGVudE5vZGU6IGZ1bmN0aW9uKHN0cmluZywgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiY29udGVudFwiO1xuICAgIHRoaXMuc3RyaW5nID0gc3RyaW5nO1xuICB9LFxuXG4gIEhhc2hOb2RlOiBmdW5jdGlvbihwYWlycywgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiaGFzaFwiO1xuICAgIHRoaXMucGFpcnMgPSBwYWlycztcbiAgfSxcblxuICBJZE5vZGU6IGZ1bmN0aW9uKHBhcnRzLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJJRFwiO1xuXG4gICAgdmFyIG9yaWdpbmFsID0gXCJcIixcbiAgICAgICAgZGlnID0gW10sXG4gICAgICAgIGRlcHRoID0gMDtcblxuICAgIGZvcih2YXIgaT0wLGw9cGFydHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgdmFyIHBhcnQgPSBwYXJ0c1tpXS5wYXJ0O1xuICAgICAgb3JpZ2luYWwgKz0gKHBhcnRzW2ldLnNlcGFyYXRvciB8fCAnJykgKyBwYXJ0O1xuXG4gICAgICBpZiAocGFydCA9PT0gXCIuLlwiIHx8IHBhcnQgPT09IFwiLlwiIHx8IHBhcnQgPT09IFwidGhpc1wiKSB7XG4gICAgICAgIGlmIChkaWcubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJJbnZhbGlkIHBhdGg6IFwiICsgb3JpZ2luYWwsIHRoaXMpO1xuICAgICAgICB9IGVsc2UgaWYgKHBhcnQgPT09IFwiLi5cIikge1xuICAgICAgICAgIGRlcHRoKys7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5pc1Njb3BlZCA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRpZy5wdXNoKHBhcnQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHRoaXMub3JpZ2luYWwgPSBvcmlnaW5hbDtcbiAgICB0aGlzLnBhcnRzICAgID0gZGlnO1xuICAgIHRoaXMuc3RyaW5nICAgPSBkaWcuam9pbignLicpO1xuICAgIHRoaXMuZGVwdGggICAgPSBkZXB0aDtcblxuICAgIC8vIGFuIElEIGlzIHNpbXBsZSBpZiBpdCBvbmx5IGhhcyBvbmUgcGFydCwgYW5kIHRoYXQgcGFydCBpcyBub3RcbiAgICAvLyBgLi5gIG9yIGB0aGlzYC5cbiAgICB0aGlzLmlzU2ltcGxlID0gcGFydHMubGVuZ3RoID09PSAxICYmICF0aGlzLmlzU2NvcGVkICYmIGRlcHRoID09PSAwO1xuXG4gICAgdGhpcy5zdHJpbmdNb2RlVmFsdWUgPSB0aGlzLnN0cmluZztcbiAgfSxcblxuICBQYXJ0aWFsTmFtZU5vZGU6IGZ1bmN0aW9uKG5hbWUsIGxvY0luZm8pIHtcbiAgICBMb2NhdGlvbkluZm8uY2FsbCh0aGlzLCBsb2NJbmZvKTtcbiAgICB0aGlzLnR5cGUgPSBcIlBBUlRJQUxfTkFNRVwiO1xuICAgIHRoaXMubmFtZSA9IG5hbWUub3JpZ2luYWw7XG4gIH0sXG5cbiAgRGF0YU5vZGU6IGZ1bmN0aW9uKGlkLCBsb2NJbmZvKSB7XG4gICAgTG9jYXRpb25JbmZvLmNhbGwodGhpcywgbG9jSW5mbyk7XG4gICAgdGhpcy50eXBlID0gXCJEQVRBXCI7XG4gICAgdGhpcy5pZCA9IGlkO1xuICB9LFxuXG4gIFN0cmluZ05vZGU6IGZ1bmN0aW9uKHN0cmluZywgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiU1RSSU5HXCI7XG4gICAgdGhpcy5vcmlnaW5hbCA9XG4gICAgICB0aGlzLnN0cmluZyA9XG4gICAgICB0aGlzLnN0cmluZ01vZGVWYWx1ZSA9IHN0cmluZztcbiAgfSxcblxuICBJbnRlZ2VyTm9kZTogZnVuY3Rpb24oaW50ZWdlciwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiSU5URUdFUlwiO1xuICAgIHRoaXMub3JpZ2luYWwgPVxuICAgICAgdGhpcy5pbnRlZ2VyID0gaW50ZWdlcjtcbiAgICB0aGlzLnN0cmluZ01vZGVWYWx1ZSA9IE51bWJlcihpbnRlZ2VyKTtcbiAgfSxcblxuICBCb29sZWFuTm9kZTogZnVuY3Rpb24oYm9vbCwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiQk9PTEVBTlwiO1xuICAgIHRoaXMuYm9vbCA9IGJvb2w7XG4gICAgdGhpcy5zdHJpbmdNb2RlVmFsdWUgPSBib29sID09PSBcInRydWVcIjtcbiAgfSxcblxuICBDb21tZW50Tm9kZTogZnVuY3Rpb24oY29tbWVudCwgbG9jSW5mbykge1xuICAgIExvY2F0aW9uSW5mby5jYWxsKHRoaXMsIGxvY0luZm8pO1xuICAgIHRoaXMudHlwZSA9IFwiY29tbWVudFwiO1xuICAgIHRoaXMuY29tbWVudCA9IGNvbW1lbnQ7XG4gIH1cbn07XG5cbi8vIE11c3QgYmUgZXhwb3J0ZWQgYXMgYW4gb2JqZWN0IHJhdGhlciB0aGFuIHRoZSByb290IG9mIHRoZSBtb2R1bGUgYXMgdGhlIGppc29uIGxleGVyXG4vLyBtb3N0IG1vZGlmeSB0aGUgb2JqZWN0IHRvIG9wZXJhdGUgcHJvcGVybHkuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEFTVDsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBwYXJzZXIgPSByZXF1aXJlKFwiLi9wYXJzZXJcIilbXCJkZWZhdWx0XCJdO1xudmFyIEFTVCA9IHJlcXVpcmUoXCIuL2FzdFwiKVtcImRlZmF1bHRcIl07XG5cbmV4cG9ydHMucGFyc2VyID0gcGFyc2VyO1xuXG5mdW5jdGlvbiBwYXJzZShpbnB1dCkge1xuICAvLyBKdXN0IHJldHVybiBpZiBhbiBhbHJlYWR5LWNvbXBpbGUgQVNUIHdhcyBwYXNzZWQgaW4uXG4gIGlmKGlucHV0LmNvbnN0cnVjdG9yID09PSBBU1QuUHJvZ3JhbU5vZGUpIHsgcmV0dXJuIGlucHV0OyB9XG5cbiAgcGFyc2VyLnl5ID0gQVNUO1xuICByZXR1cm4gcGFyc2VyLnBhcnNlKGlucHV0KTtcbn1cblxuZXhwb3J0cy5wYXJzZSA9IHBhcnNlOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xuXG5mdW5jdGlvbiBDb21waWxlcigpIHt9XG5cbmV4cG9ydHMuQ29tcGlsZXIgPSBDb21waWxlcjsvLyB0aGUgZm91bmRIZWxwZXIgcmVnaXN0ZXIgd2lsbCBkaXNhbWJpZ3VhdGUgaGVscGVyIGxvb2t1cCBmcm9tIGZpbmRpbmcgYVxuLy8gZnVuY3Rpb24gaW4gYSBjb250ZXh0LiBUaGlzIGlzIG5lY2Vzc2FyeSBmb3IgbXVzdGFjaGUgY29tcGF0aWJpbGl0eSwgd2hpY2hcbi8vIHJlcXVpcmVzIHRoYXQgY29udGV4dCBmdW5jdGlvbnMgaW4gYmxvY2tzIGFyZSBldmFsdWF0ZWQgYnkgYmxvY2tIZWxwZXJNaXNzaW5nLFxuLy8gYW5kIHRoZW4gcHJvY2VlZCBhcyBpZiB0aGUgcmVzdWx0aW5nIHZhbHVlIHdhcyBwcm92aWRlZCB0byBibG9ja0hlbHBlck1pc3NpbmcuXG5cbkNvbXBpbGVyLnByb3RvdHlwZSA9IHtcbiAgY29tcGlsZXI6IENvbXBpbGVyLFxuXG4gIGRpc2Fzc2VtYmxlOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgb3Bjb2RlcyA9IHRoaXMub3Bjb2Rlcywgb3Bjb2RlLCBvdXQgPSBbXSwgcGFyYW1zLCBwYXJhbTtcblxuICAgIGZvciAodmFyIGk9MCwgbD1vcGNvZGVzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIG9wY29kZSA9IG9wY29kZXNbaV07XG5cbiAgICAgIGlmIChvcGNvZGUub3Bjb2RlID09PSAnREVDTEFSRScpIHtcbiAgICAgICAgb3V0LnB1c2goXCJERUNMQVJFIFwiICsgb3Bjb2RlLm5hbWUgKyBcIj1cIiArIG9wY29kZS52YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwYXJhbXMgPSBbXTtcbiAgICAgICAgZm9yICh2YXIgaj0wOyBqPG9wY29kZS5hcmdzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgICAgcGFyYW0gPSBvcGNvZGUuYXJnc1tqXTtcbiAgICAgICAgICBpZiAodHlwZW9mIHBhcmFtID09PSBcInN0cmluZ1wiKSB7XG4gICAgICAgICAgICBwYXJhbSA9IFwiXFxcIlwiICsgcGFyYW0ucmVwbGFjZShcIlxcblwiLCBcIlxcXFxuXCIpICsgXCJcXFwiXCI7XG4gICAgICAgICAgfVxuICAgICAgICAgIHBhcmFtcy5wdXNoKHBhcmFtKTtcbiAgICAgICAgfVxuICAgICAgICBvdXQucHVzaChvcGNvZGUub3Bjb2RlICsgXCIgXCIgKyBwYXJhbXMuam9pbihcIiBcIikpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiBvdXQuam9pbihcIlxcblwiKTtcbiAgfSxcblxuICBlcXVhbHM6IGZ1bmN0aW9uKG90aGVyKSB7XG4gICAgdmFyIGxlbiA9IHRoaXMub3Bjb2Rlcy5sZW5ndGg7XG4gICAgaWYgKG90aGVyLm9wY29kZXMubGVuZ3RoICE9PSBsZW4pIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG5cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICB2YXIgb3Bjb2RlID0gdGhpcy5vcGNvZGVzW2ldLFxuICAgICAgICAgIG90aGVyT3Bjb2RlID0gb3RoZXIub3Bjb2Rlc1tpXTtcbiAgICAgIGlmIChvcGNvZGUub3Bjb2RlICE9PSBvdGhlck9wY29kZS5vcGNvZGUgfHwgb3Bjb2RlLmFyZ3MubGVuZ3RoICE9PSBvdGhlck9wY29kZS5hcmdzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBmb3IgKHZhciBqID0gMDsgaiA8IG9wY29kZS5hcmdzLmxlbmd0aDsgaisrKSB7XG4gICAgICAgIGlmIChvcGNvZGUuYXJnc1tqXSAhPT0gb3RoZXJPcGNvZGUuYXJnc1tqXSkge1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGxlbiA9IHRoaXMuY2hpbGRyZW4ubGVuZ3RoO1xuICAgIGlmIChvdGhlci5jaGlsZHJlbi5sZW5ndGggIT09IGxlbikge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIGlmICghdGhpcy5jaGlsZHJlbltpXS5lcXVhbHMob3RoZXIuY2hpbGRyZW5baV0pKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcblxuICBndWlkOiAwLFxuXG4gIGNvbXBpbGU6IGZ1bmN0aW9uKHByb2dyYW0sIG9wdGlvbnMpIHtcbiAgICB0aGlzLm9wY29kZXMgPSBbXTtcbiAgICB0aGlzLmNoaWxkcmVuID0gW107XG4gICAgdGhpcy5kZXB0aHMgPSB7bGlzdDogW119O1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG5cbiAgICAvLyBUaGVzZSBjaGFuZ2VzIHdpbGwgcHJvcGFnYXRlIHRvIHRoZSBvdGhlciBjb21waWxlciBjb21wb25lbnRzXG4gICAgdmFyIGtub3duSGVscGVycyA9IHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnM7XG4gICAgdGhpcy5vcHRpb25zLmtub3duSGVscGVycyA9IHtcbiAgICAgICdoZWxwZXJNaXNzaW5nJzogdHJ1ZSxcbiAgICAgICdibG9ja0hlbHBlck1pc3NpbmcnOiB0cnVlLFxuICAgICAgJ2VhY2gnOiB0cnVlLFxuICAgICAgJ2lmJzogdHJ1ZSxcbiAgICAgICd1bmxlc3MnOiB0cnVlLFxuICAgICAgJ3dpdGgnOiB0cnVlLFxuICAgICAgJ2xvZyc6IHRydWVcbiAgICB9O1xuICAgIGlmIChrbm93bkhlbHBlcnMpIHtcbiAgICAgIGZvciAodmFyIG5hbWUgaW4ga25vd25IZWxwZXJzKSB7XG4gICAgICAgIHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0gPSBrbm93bkhlbHBlcnNbbmFtZV07XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuYWNjZXB0KHByb2dyYW0pO1xuICB9LFxuXG4gIGFjY2VwdDogZnVuY3Rpb24obm9kZSkge1xuICAgIHZhciBzdHJpcCA9IG5vZGUuc3RyaXAgfHwge30sXG4gICAgICAgIHJldDtcbiAgICBpZiAoc3RyaXAubGVmdCkge1xuICAgICAgdGhpcy5vcGNvZGUoJ3N0cmlwJyk7XG4gICAgfVxuXG4gICAgcmV0ID0gdGhpc1tub2RlLnR5cGVdKG5vZGUpO1xuXG4gICAgaWYgKHN0cmlwLnJpZ2h0KSB7XG4gICAgICB0aGlzLm9wY29kZSgnc3RyaXAnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmV0O1xuICB9LFxuXG4gIHByb2dyYW06IGZ1bmN0aW9uKHByb2dyYW0pIHtcbiAgICB2YXIgc3RhdGVtZW50cyA9IHByb2dyYW0uc3RhdGVtZW50cztcblxuICAgIGZvcih2YXIgaT0wLCBsPXN0YXRlbWVudHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgdGhpcy5hY2NlcHQoc3RhdGVtZW50c1tpXSk7XG4gICAgfVxuICAgIHRoaXMuaXNTaW1wbGUgPSBsID09PSAxO1xuXG4gICAgdGhpcy5kZXB0aHMubGlzdCA9IHRoaXMuZGVwdGhzLmxpc3Quc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gYSAtIGI7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdGhpcztcbiAgfSxcblxuICBjb21waWxlUHJvZ3JhbTogZnVuY3Rpb24ocHJvZ3JhbSkge1xuICAgIHZhciByZXN1bHQgPSBuZXcgdGhpcy5jb21waWxlcigpLmNvbXBpbGUocHJvZ3JhbSwgdGhpcy5vcHRpb25zKTtcbiAgICB2YXIgZ3VpZCA9IHRoaXMuZ3VpZCsrLCBkZXB0aDtcblxuICAgIHRoaXMudXNlUGFydGlhbCA9IHRoaXMudXNlUGFydGlhbCB8fCByZXN1bHQudXNlUGFydGlhbDtcblxuICAgIHRoaXMuY2hpbGRyZW5bZ3VpZF0gPSByZXN1bHQ7XG5cbiAgICBmb3IodmFyIGk9MCwgbD1yZXN1bHQuZGVwdGhzLmxpc3QubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgZGVwdGggPSByZXN1bHQuZGVwdGhzLmxpc3RbaV07XG5cbiAgICAgIGlmKGRlcHRoIDwgMikgeyBjb250aW51ZTsgfVxuICAgICAgZWxzZSB7IHRoaXMuYWRkRGVwdGgoZGVwdGggLSAxKTsgfVxuICAgIH1cblxuICAgIHJldHVybiBndWlkO1xuICB9LFxuXG4gIGJsb2NrOiBmdW5jdGlvbihibG9jaykge1xuICAgIHZhciBtdXN0YWNoZSA9IGJsb2NrLm11c3RhY2hlLFxuICAgICAgICBwcm9ncmFtID0gYmxvY2sucHJvZ3JhbSxcbiAgICAgICAgaW52ZXJzZSA9IGJsb2NrLmludmVyc2U7XG5cbiAgICBpZiAocHJvZ3JhbSkge1xuICAgICAgcHJvZ3JhbSA9IHRoaXMuY29tcGlsZVByb2dyYW0ocHJvZ3JhbSk7XG4gICAgfVxuXG4gICAgaWYgKGludmVyc2UpIHtcbiAgICAgIGludmVyc2UgPSB0aGlzLmNvbXBpbGVQcm9ncmFtKGludmVyc2UpO1xuICAgIH1cblxuICAgIHZhciBzZXhwciA9IG11c3RhY2hlLnNleHByO1xuICAgIHZhciB0eXBlID0gdGhpcy5jbGFzc2lmeVNleHByKHNleHByKTtcblxuICAgIGlmICh0eXBlID09PSBcImhlbHBlclwiKSB7XG4gICAgICB0aGlzLmhlbHBlclNleHByKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlKTtcbiAgICB9IGVsc2UgaWYgKHR5cGUgPT09IFwic2ltcGxlXCIpIHtcbiAgICAgIHRoaXMuc2ltcGxlU2V4cHIoc2V4cHIpO1xuXG4gICAgICAvLyBub3cgdGhhdCB0aGUgc2ltcGxlIG11c3RhY2hlIGlzIHJlc29sdmVkLCB3ZSBuZWVkIHRvXG4gICAgICAvLyBldmFsdWF0ZSBpdCBieSBleGVjdXRpbmcgYGJsb2NrSGVscGVyTWlzc2luZ2BcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xuICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgaW52ZXJzZSk7XG4gICAgICB0aGlzLm9wY29kZSgnZW1wdHlIYXNoJyk7XG4gICAgICB0aGlzLm9wY29kZSgnYmxvY2tWYWx1ZScpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmFtYmlndW91c1NleHByKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlKTtcblxuICAgICAgLy8gbm93IHRoYXQgdGhlIHNpbXBsZSBtdXN0YWNoZSBpcyByZXNvbHZlZCwgd2UgbmVlZCB0b1xuICAgICAgLy8gZXZhbHVhdGUgaXQgYnkgZXhlY3V0aW5nIGBibG9ja0hlbHBlck1pc3NpbmdgXG4gICAgICB0aGlzLm9wY29kZSgncHVzaFByb2dyYW0nLCBwcm9ncmFtKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIGludmVyc2UpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2VtcHR5SGFzaCcpO1xuICAgICAgdGhpcy5vcGNvZGUoJ2FtYmlndW91c0Jsb2NrVmFsdWUnKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgnYXBwZW5kJyk7XG4gIH0sXG5cbiAgaGFzaDogZnVuY3Rpb24oaGFzaCkge1xuICAgIHZhciBwYWlycyA9IGhhc2gucGFpcnMsIHBhaXIsIHZhbDtcblxuICAgIHRoaXMub3Bjb2RlKCdwdXNoSGFzaCcpO1xuXG4gICAgZm9yKHZhciBpPTAsIGw9cGFpcnMubGVuZ3RoOyBpPGw7IGkrKykge1xuICAgICAgcGFpciA9IHBhaXJzW2ldO1xuICAgICAgdmFsICA9IHBhaXJbMV07XG5cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICAgIGlmKHZhbC5kZXB0aCkge1xuICAgICAgICAgIHRoaXMuYWRkRGVwdGgodmFsLmRlcHRoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIHZhbC5kZXB0aCB8fCAwKTtcbiAgICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hTdHJpbmdQYXJhbScsIHZhbC5zdHJpbmdNb2RlVmFsdWUsIHZhbC50eXBlKTtcblxuICAgICAgICBpZiAodmFsLnR5cGUgPT09ICdzZXhwcicpIHtcbiAgICAgICAgICAvLyBTdWJleHByZXNzaW9ucyBnZXQgZXZhbHVhdGVkIGFuZCBwYXNzZWQgaW5cbiAgICAgICAgICAvLyBpbiBzdHJpbmcgcGFyYW1zIG1vZGUuXG4gICAgICAgICAgdGhpcy5zZXhwcih2YWwpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmFjY2VwdCh2YWwpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLm9wY29kZSgnYXNzaWduVG9IYXNoJywgcGFpclswXSk7XG4gICAgfVxuICAgIHRoaXMub3Bjb2RlKCdwb3BIYXNoJyk7XG4gIH0sXG5cbiAgcGFydGlhbDogZnVuY3Rpb24ocGFydGlhbCkge1xuICAgIHZhciBwYXJ0aWFsTmFtZSA9IHBhcnRpYWwucGFydGlhbE5hbWU7XG4gICAgdGhpcy51c2VQYXJ0aWFsID0gdHJ1ZTtcblxuICAgIGlmKHBhcnRpYWwuY29udGV4dCkge1xuICAgICAgdGhpcy5JRChwYXJ0aWFsLmNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgncHVzaCcsICdkZXB0aDAnKTtcbiAgICB9XG5cbiAgICB0aGlzLm9wY29kZSgnaW52b2tlUGFydGlhbCcsIHBhcnRpYWxOYW1lLm5hbWUpO1xuICAgIHRoaXMub3Bjb2RlKCdhcHBlbmQnKTtcbiAgfSxcblxuICBjb250ZW50OiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgdGhpcy5vcGNvZGUoJ2FwcGVuZENvbnRlbnQnLCBjb250ZW50LnN0cmluZyk7XG4gIH0sXG5cbiAgbXVzdGFjaGU6IGZ1bmN0aW9uKG11c3RhY2hlKSB7XG4gICAgdGhpcy5zZXhwcihtdXN0YWNoZS5zZXhwcik7XG5cbiAgICBpZihtdXN0YWNoZS5lc2NhcGVkICYmICF0aGlzLm9wdGlvbnMubm9Fc2NhcGUpIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdhcHBlbmRFc2NhcGVkJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdhcHBlbmQnKTtcbiAgICB9XG4gIH0sXG5cbiAgYW1iaWd1b3VzU2V4cHI6IGZ1bmN0aW9uKHNleHByLCBwcm9ncmFtLCBpbnZlcnNlKSB7XG4gICAgdmFyIGlkID0gc2V4cHIuaWQsXG4gICAgICAgIG5hbWUgPSBpZC5wYXJ0c1swXSxcbiAgICAgICAgaXNCbG9jayA9IHByb2dyYW0gIT0gbnVsbCB8fCBpbnZlcnNlICE9IG51bGw7XG5cbiAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIGlkLmRlcHRoKTtcblxuICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIHByb2dyYW0pO1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoUHJvZ3JhbScsIGludmVyc2UpO1xuXG4gICAgdGhpcy5vcGNvZGUoJ2ludm9rZUFtYmlndW91cycsIG5hbWUsIGlzQmxvY2spO1xuICB9LFxuXG4gIHNpbXBsZVNleHByOiBmdW5jdGlvbihzZXhwcikge1xuICAgIHZhciBpZCA9IHNleHByLmlkO1xuXG4gICAgaWYgKGlkLnR5cGUgPT09ICdEQVRBJykge1xuICAgICAgdGhpcy5EQVRBKGlkKTtcbiAgICB9IGVsc2UgaWYgKGlkLnBhcnRzLmxlbmd0aCkge1xuICAgICAgdGhpcy5JRChpZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFNpbXBsaWZpZWQgSUQgZm9yIGB0aGlzYFxuICAgICAgdGhpcy5hZGREZXB0aChpZC5kZXB0aCk7XG4gICAgICB0aGlzLm9wY29kZSgnZ2V0Q29udGV4dCcsIGlkLmRlcHRoKTtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoQ29udGV4dCcpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdyZXNvbHZlUG9zc2libGVMYW1iZGEnKTtcbiAgfSxcblxuICBoZWxwZXJTZXhwcjogZnVuY3Rpb24oc2V4cHIsIHByb2dyYW0sIGludmVyc2UpIHtcbiAgICB2YXIgcGFyYW1zID0gdGhpcy5zZXR1cEZ1bGxNdXN0YWNoZVBhcmFtcyhzZXhwciwgcHJvZ3JhbSwgaW52ZXJzZSksXG4gICAgICAgIG5hbWUgPSBzZXhwci5pZC5wYXJ0c1swXTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMua25vd25IZWxwZXJzW25hbWVdKSB7XG4gICAgICB0aGlzLm9wY29kZSgnaW52b2tlS25vd25IZWxwZXInLCBwYXJhbXMubGVuZ3RoLCBuYW1lKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9ucy5rbm93bkhlbHBlcnNPbmx5KSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiWW91IHNwZWNpZmllZCBrbm93bkhlbHBlcnNPbmx5LCBidXQgdXNlZCB0aGUgdW5rbm93biBoZWxwZXIgXCIgKyBuYW1lLCBzZXhwcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdpbnZva2VIZWxwZXInLCBwYXJhbXMubGVuZ3RoLCBuYW1lLCBzZXhwci5pc1Jvb3QpO1xuICAgIH1cbiAgfSxcblxuICBzZXhwcjogZnVuY3Rpb24oc2V4cHIpIHtcbiAgICB2YXIgdHlwZSA9IHRoaXMuY2xhc3NpZnlTZXhwcihzZXhwcik7XG5cbiAgICBpZiAodHlwZSA9PT0gXCJzaW1wbGVcIikge1xuICAgICAgdGhpcy5zaW1wbGVTZXhwcihzZXhwcik7XG4gICAgfSBlbHNlIGlmICh0eXBlID09PSBcImhlbHBlclwiKSB7XG4gICAgICB0aGlzLmhlbHBlclNleHByKHNleHByKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hbWJpZ3VvdXNTZXhwcihzZXhwcik7XG4gICAgfVxuICB9LFxuXG4gIElEOiBmdW5jdGlvbihpZCkge1xuICAgIHRoaXMuYWRkRGVwdGgoaWQuZGVwdGgpO1xuICAgIHRoaXMub3Bjb2RlKCdnZXRDb250ZXh0JywgaWQuZGVwdGgpO1xuXG4gICAgdmFyIG5hbWUgPSBpZC5wYXJ0c1swXTtcbiAgICBpZiAoIW5hbWUpIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdwdXNoQ29udGV4dCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwT25Db250ZXh0JywgaWQucGFydHNbMF0pO1xuICAgIH1cblxuICAgIGZvcih2YXIgaT0xLCBsPWlkLnBhcnRzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHRoaXMub3Bjb2RlKCdsb29rdXAnLCBpZC5wYXJ0c1tpXSk7XG4gICAgfVxuICB9LFxuXG4gIERBVEE6IGZ1bmN0aW9uKGRhdGEpIHtcbiAgICB0aGlzLm9wdGlvbnMuZGF0YSA9IHRydWU7XG4gICAgaWYgKGRhdGEuaWQuaXNTY29wZWQgfHwgZGF0YS5pZC5kZXB0aCkge1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbignU2NvcGVkIGRhdGEgcmVmZXJlbmNlcyBhcmUgbm90IHN1cHBvcnRlZDogJyArIGRhdGEub3JpZ2luYWwsIGRhdGEpO1xuICAgIH1cblxuICAgIHRoaXMub3Bjb2RlKCdsb29rdXBEYXRhJyk7XG4gICAgdmFyIHBhcnRzID0gZGF0YS5pZC5wYXJ0cztcbiAgICBmb3IodmFyIGk9MCwgbD1wYXJ0cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICB0aGlzLm9wY29kZSgnbG9va3VwJywgcGFydHNbaV0pO1xuICAgIH1cbiAgfSxcblxuICBTVFJJTkc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoU3RyaW5nJywgc3RyaW5nLnN0cmluZyk7XG4gIH0sXG5cbiAgSU5URUdFUjogZnVuY3Rpb24oaW50ZWdlcikge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsIGludGVnZXIuaW50ZWdlcik7XG4gIH0sXG5cbiAgQk9PTEVBTjogZnVuY3Rpb24oYm9vbCkge1xuICAgIHRoaXMub3Bjb2RlKCdwdXNoTGl0ZXJhbCcsIGJvb2wuYm9vbCk7XG4gIH0sXG5cbiAgY29tbWVudDogZnVuY3Rpb24oKSB7fSxcblxuICAvLyBIRUxQRVJTXG4gIG9wY29kZTogZnVuY3Rpb24obmFtZSkge1xuICAgIHRoaXMub3Bjb2Rlcy5wdXNoKHsgb3Bjb2RlOiBuYW1lLCBhcmdzOiBbXS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSkgfSk7XG4gIH0sXG5cbiAgZGVjbGFyZTogZnVuY3Rpb24obmFtZSwgdmFsdWUpIHtcbiAgICB0aGlzLm9wY29kZXMucHVzaCh7IG9wY29kZTogJ0RFQ0xBUkUnLCBuYW1lOiBuYW1lLCB2YWx1ZTogdmFsdWUgfSk7XG4gIH0sXG5cbiAgYWRkRGVwdGg6IGZ1bmN0aW9uKGRlcHRoKSB7XG4gICAgaWYoZGVwdGggPT09IDApIHsgcmV0dXJuOyB9XG5cbiAgICBpZighdGhpcy5kZXB0aHNbZGVwdGhdKSB7XG4gICAgICB0aGlzLmRlcHRoc1tkZXB0aF0gPSB0cnVlO1xuICAgICAgdGhpcy5kZXB0aHMubGlzdC5wdXNoKGRlcHRoKTtcbiAgICB9XG4gIH0sXG5cbiAgY2xhc3NpZnlTZXhwcjogZnVuY3Rpb24oc2V4cHIpIHtcbiAgICB2YXIgaXNIZWxwZXIgICA9IHNleHByLmlzSGVscGVyO1xuICAgIHZhciBpc0VsaWdpYmxlID0gc2V4cHIuZWxpZ2libGVIZWxwZXI7XG4gICAgdmFyIG9wdGlvbnMgICAgPSB0aGlzLm9wdGlvbnM7XG5cbiAgICAvLyBpZiBhbWJpZ3VvdXMsIHdlIGNhbiBwb3NzaWJseSByZXNvbHZlIHRoZSBhbWJpZ3VpdHkgbm93XG4gICAgaWYgKGlzRWxpZ2libGUgJiYgIWlzSGVscGVyKSB7XG4gICAgICB2YXIgbmFtZSA9IHNleHByLmlkLnBhcnRzWzBdO1xuXG4gICAgICBpZiAob3B0aW9ucy5rbm93bkhlbHBlcnNbbmFtZV0pIHtcbiAgICAgICAgaXNIZWxwZXIgPSB0cnVlO1xuICAgICAgfSBlbHNlIGlmIChvcHRpb25zLmtub3duSGVscGVyc09ubHkpIHtcbiAgICAgICAgaXNFbGlnaWJsZSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChpc0hlbHBlcikgeyByZXR1cm4gXCJoZWxwZXJcIjsgfVxuICAgIGVsc2UgaWYgKGlzRWxpZ2libGUpIHsgcmV0dXJuIFwiYW1iaWd1b3VzXCI7IH1cbiAgICBlbHNlIHsgcmV0dXJuIFwic2ltcGxlXCI7IH1cbiAgfSxcblxuICBwdXNoUGFyYW1zOiBmdW5jdGlvbihwYXJhbXMpIHtcbiAgICB2YXIgaSA9IHBhcmFtcy5sZW5ndGgsIHBhcmFtO1xuXG4gICAgd2hpbGUoaS0tKSB7XG4gICAgICBwYXJhbSA9IHBhcmFtc1tpXTtcblxuICAgICAgaWYodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgICBpZihwYXJhbS5kZXB0aCkge1xuICAgICAgICAgIHRoaXMuYWRkRGVwdGgocGFyYW0uZGVwdGgpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5vcGNvZGUoJ2dldENvbnRleHQnLCBwYXJhbS5kZXB0aCB8fCAwKTtcbiAgICAgICAgdGhpcy5vcGNvZGUoJ3B1c2hTdHJpbmdQYXJhbScsIHBhcmFtLnN0cmluZ01vZGVWYWx1ZSwgcGFyYW0udHlwZSk7XG5cbiAgICAgICAgaWYgKHBhcmFtLnR5cGUgPT09ICdzZXhwcicpIHtcbiAgICAgICAgICAvLyBTdWJleHByZXNzaW9ucyBnZXQgZXZhbHVhdGVkIGFuZCBwYXNzZWQgaW5cbiAgICAgICAgICAvLyBpbiBzdHJpbmcgcGFyYW1zIG1vZGUuXG4gICAgICAgICAgdGhpcy5zZXhwcihwYXJhbSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXNbcGFyYW0udHlwZV0ocGFyYW0pO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBzZXR1cEZ1bGxNdXN0YWNoZVBhcmFtczogZnVuY3Rpb24oc2V4cHIsIHByb2dyYW0sIGludmVyc2UpIHtcbiAgICB2YXIgcGFyYW1zID0gc2V4cHIucGFyYW1zO1xuICAgIHRoaXMucHVzaFBhcmFtcyhwYXJhbXMpO1xuXG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgcHJvZ3JhbSk7XG4gICAgdGhpcy5vcGNvZGUoJ3B1c2hQcm9ncmFtJywgaW52ZXJzZSk7XG5cbiAgICBpZiAoc2V4cHIuaGFzaCkge1xuICAgICAgdGhpcy5oYXNoKHNleHByLmhhc2gpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9wY29kZSgnZW1wdHlIYXNoJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBhcmFtcztcbiAgfVxufTtcblxuZnVuY3Rpb24gcHJlY29tcGlsZShpbnB1dCwgb3B0aW9ucywgZW52KSB7XG4gIGlmIChpbnB1dCA9PSBudWxsIHx8ICh0eXBlb2YgaW5wdXQgIT09ICdzdHJpbmcnICYmIGlucHV0LmNvbnN0cnVjdG9yICE9PSBlbnYuQVNULlByb2dyYW1Ob2RlKSkge1xuICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJZb3UgbXVzdCBwYXNzIGEgc3RyaW5nIG9yIEhhbmRsZWJhcnMgQVNUIHRvIEhhbmRsZWJhcnMucHJlY29tcGlsZS4gWW91IHBhc3NlZCBcIiArIGlucHV0KTtcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBpZiAoISgnZGF0YScgaW4gb3B0aW9ucykpIHtcbiAgICBvcHRpb25zLmRhdGEgPSB0cnVlO1xuICB9XG5cbiAgdmFyIGFzdCA9IGVudi5wYXJzZShpbnB1dCk7XG4gIHZhciBlbnZpcm9ubWVudCA9IG5ldyBlbnYuQ29tcGlsZXIoKS5jb21waWxlKGFzdCwgb3B0aW9ucyk7XG4gIHJldHVybiBuZXcgZW52LkphdmFTY3JpcHRDb21waWxlcigpLmNvbXBpbGUoZW52aXJvbm1lbnQsIG9wdGlvbnMpO1xufVxuXG5leHBvcnRzLnByZWNvbXBpbGUgPSBwcmVjb21waWxlO2Z1bmN0aW9uIGNvbXBpbGUoaW5wdXQsIG9wdGlvbnMsIGVudikge1xuICBpZiAoaW5wdXQgPT0gbnVsbCB8fCAodHlwZW9mIGlucHV0ICE9PSAnc3RyaW5nJyAmJiBpbnB1dC5jb25zdHJ1Y3RvciAhPT0gZW52LkFTVC5Qcm9ncmFtTm9kZSkpIHtcbiAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiWW91IG11c3QgcGFzcyBhIHN0cmluZyBvciBIYW5kbGViYXJzIEFTVCB0byBIYW5kbGViYXJzLmNvbXBpbGUuIFlvdSBwYXNzZWQgXCIgKyBpbnB1dCk7XG4gIH1cblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICBpZiAoISgnZGF0YScgaW4gb3B0aW9ucykpIHtcbiAgICBvcHRpb25zLmRhdGEgPSB0cnVlO1xuICB9XG5cbiAgdmFyIGNvbXBpbGVkO1xuXG4gIGZ1bmN0aW9uIGNvbXBpbGVJbnB1dCgpIHtcbiAgICB2YXIgYXN0ID0gZW52LnBhcnNlKGlucHV0KTtcbiAgICB2YXIgZW52aXJvbm1lbnQgPSBuZXcgZW52LkNvbXBpbGVyKCkuY29tcGlsZShhc3QsIG9wdGlvbnMpO1xuICAgIHZhciB0ZW1wbGF0ZVNwZWMgPSBuZXcgZW52LkphdmFTY3JpcHRDb21waWxlcigpLmNvbXBpbGUoZW52aXJvbm1lbnQsIG9wdGlvbnMsIHVuZGVmaW5lZCwgdHJ1ZSk7XG4gICAgcmV0dXJuIGVudi50ZW1wbGF0ZSh0ZW1wbGF0ZVNwZWMpO1xuICB9XG5cbiAgLy8gVGVtcGxhdGUgaXMgb25seSBjb21waWxlZCBvbiBmaXJzdCB1c2UgYW5kIGNhY2hlZCBhZnRlciB0aGF0IHBvaW50LlxuICByZXR1cm4gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIGlmICghY29tcGlsZWQpIHtcbiAgICAgIGNvbXBpbGVkID0gY29tcGlsZUlucHV0KCk7XG4gICAgfVxuICAgIHJldHVybiBjb21waWxlZC5jYWxsKHRoaXMsIGNvbnRleHQsIG9wdGlvbnMpO1xuICB9O1xufVxuXG5leHBvcnRzLmNvbXBpbGUgPSBjb21waWxlOyIsIlwidXNlIHN0cmljdFwiO1xudmFyIENPTVBJTEVSX1JFVklTSU9OID0gcmVxdWlyZShcIi4uL2Jhc2VcIikuQ09NUElMRVJfUkVWSVNJT047XG52YXIgUkVWSVNJT05fQ0hBTkdFUyA9IHJlcXVpcmUoXCIuLi9iYXNlXCIpLlJFVklTSU9OX0NIQU5HRVM7XG52YXIgbG9nID0gcmVxdWlyZShcIi4uL2Jhc2VcIikubG9nO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuLi9leGNlcHRpb25cIilbXCJkZWZhdWx0XCJdO1xuXG5mdW5jdGlvbiBMaXRlcmFsKHZhbHVlKSB7XG4gIHRoaXMudmFsdWUgPSB2YWx1ZTtcbn1cblxuZnVuY3Rpb24gSmF2YVNjcmlwdENvbXBpbGVyKCkge31cblxuSmF2YVNjcmlwdENvbXBpbGVyLnByb3RvdHlwZSA9IHtcbiAgLy8gUFVCTElDIEFQSTogWW91IGNhbiBvdmVycmlkZSB0aGVzZSBtZXRob2RzIGluIGEgc3ViY2xhc3MgdG8gcHJvdmlkZVxuICAvLyBhbHRlcm5hdGl2ZSBjb21waWxlZCBmb3JtcyBmb3IgbmFtZSBsb29rdXAgYW5kIGJ1ZmZlcmluZyBzZW1hbnRpY3NcbiAgbmFtZUxvb2t1cDogZnVuY3Rpb24ocGFyZW50LCBuYW1lIC8qICwgdHlwZSovKSB7XG4gICAgdmFyIHdyYXAsXG4gICAgICAgIHJldDtcbiAgICBpZiAocGFyZW50LmluZGV4T2YoJ2RlcHRoJykgPT09IDApIHtcbiAgICAgIHdyYXAgPSB0cnVlO1xuICAgIH1cblxuICAgIGlmICgvXlswLTldKyQvLnRlc3QobmFtZSkpIHtcbiAgICAgIHJldCA9IHBhcmVudCArIFwiW1wiICsgbmFtZSArIFwiXVwiO1xuICAgIH0gZWxzZSBpZiAoSmF2YVNjcmlwdENvbXBpbGVyLmlzVmFsaWRKYXZhU2NyaXB0VmFyaWFibGVOYW1lKG5hbWUpKSB7XG4gICAgICByZXQgPSBwYXJlbnQgKyBcIi5cIiArIG5hbWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgcmV0ID0gcGFyZW50ICsgXCJbJ1wiICsgbmFtZSArIFwiJ11cIjtcbiAgICB9XG5cbiAgICBpZiAod3JhcCkge1xuICAgICAgcmV0dXJuICcoJyArIHBhcmVudCArICcgJiYgJyArIHJldCArICcpJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHJldDtcbiAgICB9XG4gIH0sXG5cbiAgY29tcGlsZXJJbmZvOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgcmV2aXNpb24gPSBDT01QSUxFUl9SRVZJU0lPTixcbiAgICAgICAgdmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW3JldmlzaW9uXTtcbiAgICByZXR1cm4gXCJ0aGlzLmNvbXBpbGVySW5mbyA9IFtcIityZXZpc2lvbitcIiwnXCIrdmVyc2lvbnMrXCInXTtcXG5cIjtcbiAgfSxcblxuICBhcHBlbmRUb0J1ZmZlcjogZnVuY3Rpb24oc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuZW52aXJvbm1lbnQuaXNTaW1wbGUpIHtcbiAgICAgIHJldHVybiBcInJldHVybiBcIiArIHN0cmluZyArIFwiO1wiO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBhcHBlbmRUb0J1ZmZlcjogdHJ1ZSxcbiAgICAgICAgY29udGVudDogc3RyaW5nLFxuICAgICAgICB0b1N0cmluZzogZnVuY3Rpb24oKSB7IHJldHVybiBcImJ1ZmZlciArPSBcIiArIHN0cmluZyArIFwiO1wiOyB9XG4gICAgICB9O1xuICAgIH1cbiAgfSxcblxuICBpbml0aWFsaXplQnVmZmVyOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5xdW90ZWRTdHJpbmcoXCJcIik7XG4gIH0sXG5cbiAgbmFtZXNwYWNlOiBcIkhhbmRsZWJhcnNcIixcbiAgLy8gRU5EIFBVQkxJQyBBUElcblxuICBjb21waWxlOiBmdW5jdGlvbihlbnZpcm9ubWVudCwgb3B0aW9ucywgY29udGV4dCwgYXNPYmplY3QpIHtcbiAgICB0aGlzLmVudmlyb25tZW50ID0gZW52aXJvbm1lbnQ7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIGxvZygnZGVidWcnLCB0aGlzLmVudmlyb25tZW50LmRpc2Fzc2VtYmxlKCkgKyBcIlxcblxcblwiKTtcblxuICAgIHRoaXMubmFtZSA9IHRoaXMuZW52aXJvbm1lbnQubmFtZTtcbiAgICB0aGlzLmlzQ2hpbGQgPSAhIWNvbnRleHQ7XG4gICAgdGhpcy5jb250ZXh0ID0gY29udGV4dCB8fCB7XG4gICAgICBwcm9ncmFtczogW10sXG4gICAgICBlbnZpcm9ubWVudHM6IFtdLFxuICAgICAgYWxpYXNlczogeyB9XG4gICAgfTtcblxuICAgIHRoaXMucHJlYW1ibGUoKTtcblxuICAgIHRoaXMuc3RhY2tTbG90ID0gMDtcbiAgICB0aGlzLnN0YWNrVmFycyA9IFtdO1xuICAgIHRoaXMucmVnaXN0ZXJzID0geyBsaXN0OiBbXSB9O1xuICAgIHRoaXMuaGFzaGVzID0gW107XG4gICAgdGhpcy5jb21waWxlU3RhY2sgPSBbXTtcbiAgICB0aGlzLmlubGluZVN0YWNrID0gW107XG5cbiAgICB0aGlzLmNvbXBpbGVDaGlsZHJlbihlbnZpcm9ubWVudCwgb3B0aW9ucyk7XG5cbiAgICB2YXIgb3Bjb2RlcyA9IGVudmlyb25tZW50Lm9wY29kZXMsIG9wY29kZTtcblxuICAgIHRoaXMuaSA9IDA7XG5cbiAgICBmb3IodmFyIGw9b3Bjb2Rlcy5sZW5ndGg7IHRoaXMuaTxsOyB0aGlzLmkrKykge1xuICAgICAgb3Bjb2RlID0gb3Bjb2Rlc1t0aGlzLmldO1xuXG4gICAgICBpZihvcGNvZGUub3Bjb2RlID09PSAnREVDTEFSRScpIHtcbiAgICAgICAgdGhpc1tvcGNvZGUubmFtZV0gPSBvcGNvZGUudmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzW29wY29kZS5vcGNvZGVdLmFwcGx5KHRoaXMsIG9wY29kZS5hcmdzKTtcbiAgICAgIH1cblxuICAgICAgLy8gUmVzZXQgdGhlIHN0cmlwTmV4dCBmbGFnIGlmIGl0IHdhcyBub3Qgc2V0IGJ5IHRoaXMgb3BlcmF0aW9uLlxuICAgICAgaWYgKG9wY29kZS5vcGNvZGUgIT09IHRoaXMuc3RyaXBOZXh0KSB7XG4gICAgICAgIHRoaXMuc3RyaXBOZXh0ID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRmx1c2ggYW55IHRyYWlsaW5nIGNvbnRlbnQgdGhhdCBtaWdodCBiZSBwZW5kaW5nLlxuICAgIHRoaXMucHVzaFNvdXJjZSgnJyk7XG5cbiAgICBpZiAodGhpcy5zdGFja1Nsb3QgfHwgdGhpcy5pbmxpbmVTdGFjay5sZW5ndGggfHwgdGhpcy5jb21waWxlU3RhY2subGVuZ3RoKSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKCdDb21waWxlIGNvbXBsZXRlZCB3aXRoIGNvbnRlbnQgbGVmdCBvbiBzdGFjaycpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNyZWF0ZUZ1bmN0aW9uQ29udGV4dChhc09iamVjdCk7XG4gIH0sXG5cbiAgcHJlYW1ibGU6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBvdXQgPSBbXTtcblxuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICB2YXIgbmFtZXNwYWNlID0gdGhpcy5uYW1lc3BhY2U7XG5cbiAgICAgIHZhciBjb3BpZXMgPSBcImhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIFwiICsgbmFtZXNwYWNlICsgXCIuaGVscGVycyk7XCI7XG4gICAgICBpZiAodGhpcy5lbnZpcm9ubWVudC51c2VQYXJ0aWFsKSB7IGNvcGllcyA9IGNvcGllcyArIFwiIHBhcnRpYWxzID0gdGhpcy5tZXJnZShwYXJ0aWFscywgXCIgKyBuYW1lc3BhY2UgKyBcIi5wYXJ0aWFscyk7XCI7IH1cbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZGF0YSkgeyBjb3BpZXMgPSBjb3BpZXMgKyBcIiBkYXRhID0gZGF0YSB8fCB7fTtcIjsgfVxuICAgICAgb3V0LnB1c2goY29waWVzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0LnB1c2goJycpO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5lbnZpcm9ubWVudC5pc1NpbXBsZSkge1xuICAgICAgb3V0LnB1c2goXCIsIGJ1ZmZlciA9IFwiICsgdGhpcy5pbml0aWFsaXplQnVmZmVyKCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdXQucHVzaChcIlwiKTtcbiAgICB9XG5cbiAgICAvLyB0cmFjayB0aGUgbGFzdCBjb250ZXh0IHB1c2hlZCBpbnRvIHBsYWNlIHRvIGFsbG93IHNraXBwaW5nIHRoZVxuICAgIC8vIGdldENvbnRleHQgb3Bjb2RlIHdoZW4gaXQgd291bGQgYmUgYSBub29wXG4gICAgdGhpcy5sYXN0Q29udGV4dCA9IDA7XG4gICAgdGhpcy5zb3VyY2UgPSBvdXQ7XG4gIH0sXG5cbiAgY3JlYXRlRnVuY3Rpb25Db250ZXh0OiBmdW5jdGlvbihhc09iamVjdCkge1xuICAgIHZhciBsb2NhbHMgPSB0aGlzLnN0YWNrVmFycy5jb25jYXQodGhpcy5yZWdpc3RlcnMubGlzdCk7XG5cbiAgICBpZihsb2NhbHMubGVuZ3RoID4gMCkge1xuICAgICAgdGhpcy5zb3VyY2VbMV0gPSB0aGlzLnNvdXJjZVsxXSArIFwiLCBcIiArIGxvY2Fscy5qb2luKFwiLCBcIik7XG4gICAgfVxuXG4gICAgLy8gR2VuZXJhdGUgbWluaW1pemVyIGFsaWFzIG1hcHBpbmdzXG4gICAgaWYgKCF0aGlzLmlzQ2hpbGQpIHtcbiAgICAgIGZvciAodmFyIGFsaWFzIGluIHRoaXMuY29udGV4dC5hbGlhc2VzKSB7XG4gICAgICAgIGlmICh0aGlzLmNvbnRleHQuYWxpYXNlcy5oYXNPd25Qcm9wZXJ0eShhbGlhcykpIHtcbiAgICAgICAgICB0aGlzLnNvdXJjZVsxXSA9IHRoaXMuc291cmNlWzFdICsgJywgJyArIGFsaWFzICsgJz0nICsgdGhpcy5jb250ZXh0LmFsaWFzZXNbYWxpYXNdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuc291cmNlWzFdKSB7XG4gICAgICB0aGlzLnNvdXJjZVsxXSA9IFwidmFyIFwiICsgdGhpcy5zb3VyY2VbMV0uc3Vic3RyaW5nKDIpICsgXCI7XCI7XG4gICAgfVxuXG4gICAgLy8gTWVyZ2UgY2hpbGRyZW5cbiAgICBpZiAoIXRoaXMuaXNDaGlsZCkge1xuICAgICAgdGhpcy5zb3VyY2VbMV0gKz0gJ1xcbicgKyB0aGlzLmNvbnRleHQucHJvZ3JhbXMuam9pbignXFxuJykgKyAnXFxuJztcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuZW52aXJvbm1lbnQuaXNTaW1wbGUpIHtcbiAgICAgIHRoaXMucHVzaFNvdXJjZShcInJldHVybiBidWZmZXI7XCIpO1xuICAgIH1cblxuICAgIHZhciBwYXJhbXMgPSB0aGlzLmlzQ2hpbGQgPyBbXCJkZXB0aDBcIiwgXCJkYXRhXCJdIDogW1wiSGFuZGxlYmFyc1wiLCBcImRlcHRoMFwiLCBcImhlbHBlcnNcIiwgXCJwYXJ0aWFsc1wiLCBcImRhdGFcIl07XG5cbiAgICBmb3IodmFyIGk9MCwgbD10aGlzLmVudmlyb25tZW50LmRlcHRocy5saXN0Lmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIHBhcmFtcy5wdXNoKFwiZGVwdGhcIiArIHRoaXMuZW52aXJvbm1lbnQuZGVwdGhzLmxpc3RbaV0pO1xuICAgIH1cblxuICAgIC8vIFBlcmZvcm0gYSBzZWNvbmQgcGFzcyBvdmVyIHRoZSBvdXRwdXQgdG8gbWVyZ2UgY29udGVudCB3aGVuIHBvc3NpYmxlXG4gICAgdmFyIHNvdXJjZSA9IHRoaXMubWVyZ2VTb3VyY2UoKTtcblxuICAgIGlmICghdGhpcy5pc0NoaWxkKSB7XG4gICAgICBzb3VyY2UgPSB0aGlzLmNvbXBpbGVySW5mbygpK3NvdXJjZTtcbiAgICB9XG5cbiAgICBpZiAoYXNPYmplY3QpIHtcbiAgICAgIHBhcmFtcy5wdXNoKHNvdXJjZSk7XG5cbiAgICAgIHJldHVybiBGdW5jdGlvbi5hcHBseSh0aGlzLCBwYXJhbXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgZnVuY3Rpb25Tb3VyY2UgPSAnZnVuY3Rpb24gJyArICh0aGlzLm5hbWUgfHwgJycpICsgJygnICsgcGFyYW1zLmpvaW4oJywnKSArICcpIHtcXG4gICcgKyBzb3VyY2UgKyAnfSc7XG4gICAgICBsb2coJ2RlYnVnJywgZnVuY3Rpb25Tb3VyY2UgKyBcIlxcblxcblwiKTtcbiAgICAgIHJldHVybiBmdW5jdGlvblNvdXJjZTtcbiAgICB9XG4gIH0sXG4gIG1lcmdlU291cmNlOiBmdW5jdGlvbigpIHtcbiAgICAvLyBXQVJOOiBXZSBhcmUgbm90IGhhbmRsaW5nIHRoZSBjYXNlIHdoZXJlIGJ1ZmZlciBpcyBzdGlsbCBwb3B1bGF0ZWQgYXMgdGhlIHNvdXJjZSBzaG91bGRcbiAgICAvLyBub3QgaGF2ZSBidWZmZXIgYXBwZW5kIG9wZXJhdGlvbnMgYXMgdGhlaXIgZmluYWwgYWN0aW9uLlxuICAgIHZhciBzb3VyY2UgPSAnJyxcbiAgICAgICAgYnVmZmVyO1xuICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSB0aGlzLnNvdXJjZS5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgdmFyIGxpbmUgPSB0aGlzLnNvdXJjZVtpXTtcbiAgICAgIGlmIChsaW5lLmFwcGVuZFRvQnVmZmVyKSB7XG4gICAgICAgIGlmIChidWZmZXIpIHtcbiAgICAgICAgICBidWZmZXIgPSBidWZmZXIgKyAnXFxuICAgICsgJyArIGxpbmUuY29udGVudDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBidWZmZXIgPSBsaW5lLmNvbnRlbnQ7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChidWZmZXIpIHtcbiAgICAgICAgICBzb3VyY2UgKz0gJ2J1ZmZlciArPSAnICsgYnVmZmVyICsgJztcXG4gICc7XG4gICAgICAgICAgYnVmZmVyID0gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHNvdXJjZSArPSBsaW5lICsgJ1xcbiAgJztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNvdXJjZTtcbiAgfSxcblxuICAvLyBbYmxvY2tWYWx1ZV1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgdmFsdWVcbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXR1cm4gdmFsdWUgb2YgYmxvY2tIZWxwZXJNaXNzaW5nXG4gIC8vXG4gIC8vIFRoZSBwdXJwb3NlIG9mIHRoaXMgb3Bjb2RlIGlzIHRvIHRha2UgYSBibG9jayBvZiB0aGUgZm9ybVxuICAvLyBge3sjZm9vfX0uLi57ey9mb299fWAsIHJlc29sdmUgdGhlIHZhbHVlIG9mIGBmb29gLCBhbmRcbiAgLy8gcmVwbGFjZSBpdCBvbiB0aGUgc3RhY2sgd2l0aCB0aGUgcmVzdWx0IG9mIHByb3Blcmx5XG4gIC8vIGludm9raW5nIGJsb2NrSGVscGVyTWlzc2luZy5cbiAgYmxvY2tWYWx1ZTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuYmxvY2tIZWxwZXJNaXNzaW5nID0gJ2hlbHBlcnMuYmxvY2tIZWxwZXJNaXNzaW5nJztcblxuICAgIHZhciBwYXJhbXMgPSBbXCJkZXB0aDBcIl07XG4gICAgdGhpcy5zZXR1cFBhcmFtcygwLCBwYXJhbXMpO1xuXG4gICAgdGhpcy5yZXBsYWNlU3RhY2soZnVuY3Rpb24oY3VycmVudCkge1xuICAgICAgcGFyYW1zLnNwbGljZSgxLCAwLCBjdXJyZW50KTtcbiAgICAgIHJldHVybiBcImJsb2NrSGVscGVyTWlzc2luZy5jYWxsKFwiICsgcGFyYW1zLmpvaW4oXCIsIFwiKSArIFwiKVwiO1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFthbWJpZ3VvdXNCbG9ja1ZhbHVlXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCB2YWx1ZVxuICAvLyBDb21waWxlciB2YWx1ZSwgYmVmb3JlOiBsYXN0SGVscGVyPXZhbHVlIG9mIGxhc3QgZm91bmQgaGVscGVyLCBpZiBhbnlcbiAgLy8gT24gc3RhY2ssIGFmdGVyLCBpZiBubyBsYXN0SGVscGVyOiBzYW1lIGFzIFtibG9ja1ZhbHVlXVxuICAvLyBPbiBzdGFjaywgYWZ0ZXIsIGlmIGxhc3RIZWxwZXI6IHZhbHVlXG4gIGFtYmlndW91c0Jsb2NrVmFsdWU6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLmJsb2NrSGVscGVyTWlzc2luZyA9ICdoZWxwZXJzLmJsb2NrSGVscGVyTWlzc2luZyc7XG5cbiAgICB2YXIgcGFyYW1zID0gW1wiZGVwdGgwXCJdO1xuICAgIHRoaXMuc2V0dXBQYXJhbXMoMCwgcGFyYW1zKTtcblxuICAgIHZhciBjdXJyZW50ID0gdGhpcy50b3BTdGFjaygpO1xuICAgIHBhcmFtcy5zcGxpY2UoMSwgMCwgY3VycmVudCk7XG5cbiAgICB0aGlzLnB1c2hTb3VyY2UoXCJpZiAoIVwiICsgdGhpcy5sYXN0SGVscGVyICsgXCIpIHsgXCIgKyBjdXJyZW50ICsgXCIgPSBibG9ja0hlbHBlck1pc3NpbmcuY2FsbChcIiArIHBhcmFtcy5qb2luKFwiLCBcIikgKyBcIik7IH1cIik7XG4gIH0sXG5cbiAgLy8gW2FwcGVuZENvbnRlbnRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvL1xuICAvLyBBcHBlbmRzIHRoZSBzdHJpbmcgdmFsdWUgb2YgYGNvbnRlbnRgIHRvIHRoZSBjdXJyZW50IGJ1ZmZlclxuICBhcHBlbmRDb250ZW50OiBmdW5jdGlvbihjb250ZW50KSB7XG4gICAgaWYgKHRoaXMucGVuZGluZ0NvbnRlbnQpIHtcbiAgICAgIGNvbnRlbnQgPSB0aGlzLnBlbmRpbmdDb250ZW50ICsgY29udGVudDtcbiAgICB9XG4gICAgaWYgKHRoaXMuc3RyaXBOZXh0KSB7XG4gICAgICBjb250ZW50ID0gY29udGVudC5yZXBsYWNlKC9eXFxzKy8sICcnKTtcbiAgICB9XG5cbiAgICB0aGlzLnBlbmRpbmdDb250ZW50ID0gY29udGVudDtcbiAgfSxcblxuICAvLyBbc3RyaXBdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvL1xuICAvLyBSZW1vdmVzIGFueSB0cmFpbGluZyB3aGl0ZXNwYWNlIGZyb20gdGhlIHByaW9yIGNvbnRlbnQgbm9kZSBhbmQgZmxhZ3NcbiAgLy8gdGhlIG5leHQgb3BlcmF0aW9uIGZvciBzdHJpcHBpbmcgaWYgaXQgaXMgYSBjb250ZW50IG5vZGUuXG4gIHN0cmlwOiBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5wZW5kaW5nQ29udGVudCkge1xuICAgICAgdGhpcy5wZW5kaW5nQ29udGVudCA9IHRoaXMucGVuZGluZ0NvbnRlbnQucmVwbGFjZSgvXFxzKyQvLCAnJyk7XG4gICAgfVxuICAgIHRoaXMuc3RyaXBOZXh0ID0gJ3N0cmlwJztcbiAgfSxcblxuICAvLyBbYXBwZW5kXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vXG4gIC8vIENvZXJjZXMgYHZhbHVlYCB0byBhIFN0cmluZyBhbmQgYXBwZW5kcyBpdCB0byB0aGUgY3VycmVudCBidWZmZXIuXG4gIC8vXG4gIC8vIElmIGB2YWx1ZWAgaXMgdHJ1dGh5LCBvciAwLCBpdCBpcyBjb2VyY2VkIGludG8gYSBzdHJpbmcgYW5kIGFwcGVuZGVkXG4gIC8vIE90aGVyd2lzZSwgdGhlIGVtcHR5IHN0cmluZyBpcyBhcHBlbmRlZFxuICBhcHBlbmQ6IGZ1bmN0aW9uKCkge1xuICAgIC8vIEZvcmNlIGFueXRoaW5nIHRoYXQgaXMgaW5saW5lZCBvbnRvIHRoZSBzdGFjayBzbyB3ZSBkb24ndCBoYXZlIGR1cGxpY2F0aW9uXG4gICAgLy8gd2hlbiB3ZSBleGFtaW5lIGxvY2FsXG4gICAgdGhpcy5mbHVzaElubGluZSgpO1xuICAgIHZhciBsb2NhbCA9IHRoaXMucG9wU3RhY2soKTtcbiAgICB0aGlzLnB1c2hTb3VyY2UoXCJpZihcIiArIGxvY2FsICsgXCIgfHwgXCIgKyBsb2NhbCArIFwiID09PSAwKSB7IFwiICsgdGhpcy5hcHBlbmRUb0J1ZmZlcihsb2NhbCkgKyBcIiB9XCIpO1xuICAgIGlmICh0aGlzLmVudmlyb25tZW50LmlzU2ltcGxlKSB7XG4gICAgICB0aGlzLnB1c2hTb3VyY2UoXCJlbHNlIHsgXCIgKyB0aGlzLmFwcGVuZFRvQnVmZmVyKFwiJydcIikgKyBcIiB9XCIpO1xuICAgIH1cbiAgfSxcblxuICAvLyBbYXBwZW5kRXNjYXBlZF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IC4uLlxuICAvL1xuICAvLyBFc2NhcGUgYHZhbHVlYCBhbmQgYXBwZW5kIGl0IHRvIHRoZSBidWZmZXJcbiAgYXBwZW5kRXNjYXBlZDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuZXNjYXBlRXhwcmVzc2lvbiA9ICd0aGlzLmVzY2FwZUV4cHJlc3Npb24nO1xuXG4gICAgdGhpcy5wdXNoU291cmNlKHRoaXMuYXBwZW5kVG9CdWZmZXIoXCJlc2NhcGVFeHByZXNzaW9uKFwiICsgdGhpcy5wb3BTdGFjaygpICsgXCIpXCIpKTtcbiAgfSxcblxuICAvLyBbZ2V0Q29udGV4dF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogLi4uXG4gIC8vIENvbXBpbGVyIHZhbHVlLCBhZnRlcjogbGFzdENvbnRleHQ9ZGVwdGhcbiAgLy9cbiAgLy8gU2V0IHRoZSB2YWx1ZSBvZiB0aGUgYGxhc3RDb250ZXh0YCBjb21waWxlciB2YWx1ZSB0byB0aGUgZGVwdGhcbiAgZ2V0Q29udGV4dDogZnVuY3Rpb24oZGVwdGgpIHtcbiAgICBpZih0aGlzLmxhc3RDb250ZXh0ICE9PSBkZXB0aCkge1xuICAgICAgdGhpcy5sYXN0Q29udGV4dCA9IGRlcHRoO1xuICAgIH1cbiAgfSxcblxuICAvLyBbbG9va3VwT25Db250ZXh0XVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBjdXJyZW50Q29udGV4dFtuYW1lXSwgLi4uXG4gIC8vXG4gIC8vIExvb2tzIHVwIHRoZSB2YWx1ZSBvZiBgbmFtZWAgb24gdGhlIGN1cnJlbnQgY29udGV4dCBhbmQgcHVzaGVzXG4gIC8vIGl0IG9udG8gdGhlIHN0YWNrLlxuICBsb29rdXBPbkNvbnRleHQ6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICB0aGlzLnB1c2godGhpcy5uYW1lTG9va3VwKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0LCBuYW1lLCAnY29udGV4dCcpKTtcbiAgfSxcblxuICAvLyBbcHVzaENvbnRleHRdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGN1cnJlbnRDb250ZXh0LCAuLi5cbiAgLy9cbiAgLy8gUHVzaGVzIHRoZSB2YWx1ZSBvZiB0aGUgY3VycmVudCBjb250ZXh0IG9udG8gdGhlIHN0YWNrLlxuICBwdXNoQ29udGV4dDogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0KTtcbiAgfSxcblxuICAvLyBbcmVzb2x2ZVBvc3NpYmxlTGFtYmRhXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzb2x2ZWQgdmFsdWUsIC4uLlxuICAvL1xuICAvLyBJZiB0aGUgYHZhbHVlYCBpcyBhIGxhbWJkYSwgcmVwbGFjZSBpdCBvbiB0aGUgc3RhY2sgYnlcbiAgLy8gdGhlIHJldHVybiB2YWx1ZSBvZiB0aGUgbGFtYmRhXG4gIHJlc29sdmVQb3NzaWJsZUxhbWJkYTogZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuZnVuY3Rpb25UeXBlID0gJ1wiZnVuY3Rpb25cIic7XG5cbiAgICB0aGlzLnJlcGxhY2VTdGFjayhmdW5jdGlvbihjdXJyZW50KSB7XG4gICAgICByZXR1cm4gXCJ0eXBlb2YgXCIgKyBjdXJyZW50ICsgXCIgPT09IGZ1bmN0aW9uVHlwZSA/IFwiICsgY3VycmVudCArIFwiLmFwcGx5KGRlcHRoMCkgOiBcIiArIGN1cnJlbnQ7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gW2xvb2t1cF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogdmFsdWUsIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHZhbHVlW25hbWVdLCAuLi5cbiAgLy9cbiAgLy8gUmVwbGFjZSB0aGUgdmFsdWUgb24gdGhlIHN0YWNrIHdpdGggdGhlIHJlc3VsdCBvZiBsb29raW5nXG4gIC8vIHVwIGBuYW1lYCBvbiBgdmFsdWVgXG4gIGxvb2t1cDogZnVuY3Rpb24obmFtZSkge1xuICAgIHRoaXMucmVwbGFjZVN0YWNrKGZ1bmN0aW9uKGN1cnJlbnQpIHtcbiAgICAgIHJldHVybiBjdXJyZW50ICsgXCIgPT0gbnVsbCB8fCBcIiArIGN1cnJlbnQgKyBcIiA9PT0gZmFsc2UgPyBcIiArIGN1cnJlbnQgKyBcIiA6IFwiICsgdGhpcy5uYW1lTG9va3VwKGN1cnJlbnQsIG5hbWUsICdjb250ZXh0Jyk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gW2xvb2t1cERhdGFdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IGRhdGEsIC4uLlxuICAvL1xuICAvLyBQdXNoIHRoZSBkYXRhIGxvb2t1cCBvcGVyYXRvclxuICBsb29rdXBEYXRhOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ2RhdGEnKTtcbiAgfSxcblxuICAvLyBbcHVzaFN0cmluZ1BhcmFtXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiBzdHJpbmcsIGN1cnJlbnRDb250ZXh0LCAuLi5cbiAgLy9cbiAgLy8gVGhpcyBvcGNvZGUgaXMgZGVzaWduZWQgZm9yIHVzZSBpbiBzdHJpbmcgbW9kZSwgd2hpY2hcbiAgLy8gcHJvdmlkZXMgdGhlIHN0cmluZyB2YWx1ZSBvZiBhIHBhcmFtZXRlciBhbG9uZyB3aXRoIGl0c1xuICAvLyBkZXB0aCByYXRoZXIgdGhhbiByZXNvbHZpbmcgaXQgaW1tZWRpYXRlbHkuXG4gIHB1c2hTdHJpbmdQYXJhbTogZnVuY3Rpb24oc3RyaW5nLCB0eXBlKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKCdkZXB0aCcgKyB0aGlzLmxhc3RDb250ZXh0KTtcblxuICAgIHRoaXMucHVzaFN0cmluZyh0eXBlKTtcblxuICAgIC8vIElmIGl0J3MgYSBzdWJleHByZXNzaW9uLCB0aGUgc3RyaW5nIHJlc3VsdFxuICAgIC8vIHdpbGwgYmUgcHVzaGVkIGFmdGVyIHRoaXMgb3Bjb2RlLlxuICAgIGlmICh0eXBlICE9PSAnc2V4cHInKSB7XG4gICAgICBpZiAodHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgdGhpcy5wdXNoU3RyaW5nKHN0cmluZyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoc3RyaW5nKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgZW1wdHlIYXNoOiBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwoJ3t9Jyk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgdGhpcy5wdXNoKCd7fScpOyAvLyBoYXNoQ29udGV4dHNcbiAgICAgIHRoaXMucHVzaCgne30nKTsgLy8gaGFzaFR5cGVzXG4gICAgfVxuICB9LFxuICBwdXNoSGFzaDogZnVuY3Rpb24oKSB7XG4gICAgaWYgKHRoaXMuaGFzaCkge1xuICAgICAgdGhpcy5oYXNoZXMucHVzaCh0aGlzLmhhc2gpO1xuICAgIH1cbiAgICB0aGlzLmhhc2ggPSB7dmFsdWVzOiBbXSwgdHlwZXM6IFtdLCBjb250ZXh0czogW119O1xuICB9LFxuICBwb3BIYXNoOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaGFzaCA9IHRoaXMuaGFzaDtcbiAgICB0aGlzLmhhc2ggPSB0aGlzLmhhc2hlcy5wb3AoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICB0aGlzLnB1c2goJ3snICsgaGFzaC5jb250ZXh0cy5qb2luKCcsJykgKyAnfScpO1xuICAgICAgdGhpcy5wdXNoKCd7JyArIGhhc2gudHlwZXMuam9pbignLCcpICsgJ30nKTtcbiAgICB9XG5cbiAgICB0aGlzLnB1c2goJ3tcXG4gICAgJyArIGhhc2gudmFsdWVzLmpvaW4oJyxcXG4gICAgJykgKyAnXFxuICB9Jyk7XG4gIH0sXG5cbiAgLy8gW3B1c2hTdHJpbmddXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHF1b3RlZFN0cmluZyhzdHJpbmcpLCAuLi5cbiAgLy9cbiAgLy8gUHVzaCBhIHF1b3RlZCB2ZXJzaW9uIG9mIGBzdHJpbmdgIG9udG8gdGhlIHN0YWNrXG4gIHB1c2hTdHJpbmc6IGZ1bmN0aW9uKHN0cmluZykge1xuICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbCh0aGlzLnF1b3RlZFN0cmluZyhzdHJpbmcpKTtcbiAgfSxcblxuICAvLyBbcHVzaF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogZXhwciwgLi4uXG4gIC8vXG4gIC8vIFB1c2ggYW4gZXhwcmVzc2lvbiBvbnRvIHRoZSBzdGFja1xuICBwdXNoOiBmdW5jdGlvbihleHByKSB7XG4gICAgdGhpcy5pbmxpbmVTdGFjay5wdXNoKGV4cHIpO1xuICAgIHJldHVybiBleHByO1xuICB9LFxuXG4gIC8vIFtwdXNoTGl0ZXJhbF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogdmFsdWUsIC4uLlxuICAvL1xuICAvLyBQdXNoZXMgYSB2YWx1ZSBvbnRvIHRoZSBzdGFjay4gVGhpcyBvcGVyYXRpb24gcHJldmVudHNcbiAgLy8gdGhlIGNvbXBpbGVyIGZyb20gY3JlYXRpbmcgYSB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gaG9sZFxuICAvLyBpdC5cbiAgcHVzaExpdGVyYWw6IGZ1bmN0aW9uKHZhbHVlKSB7XG4gICAgdGhpcy5wdXNoU3RhY2tMaXRlcmFsKHZhbHVlKTtcbiAgfSxcblxuICAvLyBbcHVzaFByb2dyYW1dXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHByb2dyYW0oZ3VpZCksIC4uLlxuICAvL1xuICAvLyBQdXNoIGEgcHJvZ3JhbSBleHByZXNzaW9uIG9udG8gdGhlIHN0YWNrLiBUaGlzIHRha2VzXG4gIC8vIGEgY29tcGlsZS10aW1lIGd1aWQgYW5kIGNvbnZlcnRzIGl0IGludG8gYSBydW50aW1lLWFjY2Vzc2libGVcbiAgLy8gZXhwcmVzc2lvbi5cbiAgcHVzaFByb2dyYW06IGZ1bmN0aW9uKGd1aWQpIHtcbiAgICBpZiAoZ3VpZCAhPSBudWxsKSB7XG4gICAgICB0aGlzLnB1c2hTdGFja0xpdGVyYWwodGhpcy5wcm9ncmFtRXhwcmVzc2lvbihndWlkKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucHVzaFN0YWNrTGl0ZXJhbChudWxsKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gW2ludm9rZUhlbHBlcl1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogaGFzaCwgaW52ZXJzZSwgcHJvZ3JhbSwgcGFyYW1zLi4uLCAuLi5cbiAgLy8gT24gc3RhY2ssIGFmdGVyOiByZXN1bHQgb2YgaGVscGVyIGludm9jYXRpb25cbiAgLy9cbiAgLy8gUG9wcyBvZmYgdGhlIGhlbHBlcidzIHBhcmFtZXRlcnMsIGludm9rZXMgdGhlIGhlbHBlcixcbiAgLy8gYW5kIHB1c2hlcyB0aGUgaGVscGVyJ3MgcmV0dXJuIHZhbHVlIG9udG8gdGhlIHN0YWNrLlxuICAvL1xuICAvLyBJZiB0aGUgaGVscGVyIGlzIG5vdCBmb3VuZCwgYGhlbHBlck1pc3NpbmdgIGlzIGNhbGxlZC5cbiAgaW52b2tlSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUsIGlzUm9vdCkge1xuICAgIHRoaXMuY29udGV4dC5hbGlhc2VzLmhlbHBlck1pc3NpbmcgPSAnaGVscGVycy5oZWxwZXJNaXNzaW5nJztcbiAgICB0aGlzLnVzZVJlZ2lzdGVyKCdoZWxwZXInKTtcblxuICAgIHZhciBoZWxwZXIgPSB0aGlzLmxhc3RIZWxwZXIgPSB0aGlzLnNldHVwSGVscGVyKHBhcmFtU2l6ZSwgbmFtZSwgdHJ1ZSk7XG4gICAgdmFyIG5vbkhlbHBlciA9IHRoaXMubmFtZUxvb2t1cCgnZGVwdGgnICsgdGhpcy5sYXN0Q29udGV4dCwgbmFtZSwgJ2NvbnRleHQnKTtcblxuICAgIHZhciBsb29rdXAgPSAnaGVscGVyID0gJyArIGhlbHBlci5uYW1lICsgJyB8fCAnICsgbm9uSGVscGVyO1xuICAgIGlmIChoZWxwZXIucGFyYW1zSW5pdCkge1xuICAgICAgbG9va3VwICs9ICcsJyArIGhlbHBlci5wYXJhbXNJbml0O1xuICAgIH1cblxuICAgIHRoaXMucHVzaChcbiAgICAgICcoJ1xuICAgICAgICArIGxvb2t1cFxuICAgICAgICArICcsaGVscGVyICdcbiAgICAgICAgICArICc/IGhlbHBlci5jYWxsKCcgKyBoZWxwZXIuY2FsbFBhcmFtcyArICcpICdcbiAgICAgICAgICArICc6IGhlbHBlck1pc3NpbmcuY2FsbCgnICsgaGVscGVyLmhlbHBlck1pc3NpbmdQYXJhbXMgKyAnKSknKTtcblxuICAgIC8vIEFsd2F5cyBmbHVzaCBzdWJleHByZXNzaW9ucy4gVGhpcyBpcyBib3RoIHRvIHByZXZlbnQgdGhlIGNvbXBvdW5kaW5nIHNpemUgaXNzdWUgdGhhdFxuICAgIC8vIG9jY3VycyB3aGVuIHRoZSBjb2RlIGhhcyB0byBiZSBkdXBsaWNhdGVkIGZvciBpbmxpbmluZyBhbmQgYWxzbyB0byBwcmV2ZW50IGVycm9yc1xuICAgIC8vIGR1ZSB0byB0aGUgaW5jb3JyZWN0IG9wdGlvbnMgb2JqZWN0IGJlaW5nIHBhc3NlZCBkdWUgdG8gdGhlIHNoYXJlZCByZWdpc3Rlci5cbiAgICBpZiAoIWlzUm9vdCkge1xuICAgICAgdGhpcy5mbHVzaElubGluZSgpO1xuICAgIH1cbiAgfSxcblxuICAvLyBbaW52b2tlS25vd25IZWxwZXJdXG4gIC8vXG4gIC8vIE9uIHN0YWNrLCBiZWZvcmU6IGhhc2gsIGludmVyc2UsIHByb2dyYW0sIHBhcmFtcy4uLiwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogcmVzdWx0IG9mIGhlbHBlciBpbnZvY2F0aW9uXG4gIC8vXG4gIC8vIFRoaXMgb3BlcmF0aW9uIGlzIHVzZWQgd2hlbiB0aGUgaGVscGVyIGlzIGtub3duIHRvIGV4aXN0LFxuICAvLyBzbyBhIGBoZWxwZXJNaXNzaW5nYCBmYWxsYmFjayBpcyBub3QgcmVxdWlyZWQuXG4gIGludm9rZUtub3duSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUpIHtcbiAgICB2YXIgaGVscGVyID0gdGhpcy5zZXR1cEhlbHBlcihwYXJhbVNpemUsIG5hbWUpO1xuICAgIHRoaXMucHVzaChoZWxwZXIubmFtZSArIFwiLmNhbGwoXCIgKyBoZWxwZXIuY2FsbFBhcmFtcyArIFwiKVwiKTtcbiAgfSxcblxuICAvLyBbaW52b2tlQW1iaWd1b3VzXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiBoYXNoLCBpbnZlcnNlLCBwcm9ncmFtLCBwYXJhbXMuLi4sIC4uLlxuICAvLyBPbiBzdGFjaywgYWZ0ZXI6IHJlc3VsdCBvZiBkaXNhbWJpZ3VhdGlvblxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBpcyB1c2VkIHdoZW4gYW4gZXhwcmVzc2lvbiBsaWtlIGB7e2Zvb319YFxuICAvLyBpcyBwcm92aWRlZCwgYnV0IHdlIGRvbid0IGtub3cgYXQgY29tcGlsZS10aW1lIHdoZXRoZXIgaXRcbiAgLy8gaXMgYSBoZWxwZXIgb3IgYSBwYXRoLlxuICAvL1xuICAvLyBUaGlzIG9wZXJhdGlvbiBlbWl0cyBtb3JlIGNvZGUgdGhhbiB0aGUgb3RoZXIgb3B0aW9ucyxcbiAgLy8gYW5kIGNhbiBiZSBhdm9pZGVkIGJ5IHBhc3NpbmcgdGhlIGBrbm93bkhlbHBlcnNgIGFuZFxuICAvLyBga25vd25IZWxwZXJzT25seWAgZmxhZ3MgYXQgY29tcGlsZS10aW1lLlxuICBpbnZva2VBbWJpZ3VvdXM6IGZ1bmN0aW9uKG5hbWUsIGhlbHBlckNhbGwpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5mdW5jdGlvblR5cGUgPSAnXCJmdW5jdGlvblwiJztcbiAgICB0aGlzLnVzZVJlZ2lzdGVyKCdoZWxwZXInKTtcblxuICAgIHRoaXMuZW1wdHlIYXNoKCk7XG4gICAgdmFyIGhlbHBlciA9IHRoaXMuc2V0dXBIZWxwZXIoMCwgbmFtZSwgaGVscGVyQ2FsbCk7XG5cbiAgICB2YXIgaGVscGVyTmFtZSA9IHRoaXMubGFzdEhlbHBlciA9IHRoaXMubmFtZUxvb2t1cCgnaGVscGVycycsIG5hbWUsICdoZWxwZXInKTtcblxuICAgIHZhciBub25IZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2RlcHRoJyArIHRoaXMubGFzdENvbnRleHQsIG5hbWUsICdjb250ZXh0Jyk7XG4gICAgdmFyIG5leHRTdGFjayA9IHRoaXMubmV4dFN0YWNrKCk7XG5cbiAgICBpZiAoaGVscGVyLnBhcmFtc0luaXQpIHtcbiAgICAgIHRoaXMucHVzaFNvdXJjZShoZWxwZXIucGFyYW1zSW5pdCk7XG4gICAgfVxuICAgIHRoaXMucHVzaFNvdXJjZSgnaWYgKGhlbHBlciA9ICcgKyBoZWxwZXJOYW1lICsgJykgeyAnICsgbmV4dFN0YWNrICsgJyA9IGhlbHBlci5jYWxsKCcgKyBoZWxwZXIuY2FsbFBhcmFtcyArICcpOyB9Jyk7XG4gICAgdGhpcy5wdXNoU291cmNlKCdlbHNlIHsgaGVscGVyID0gJyArIG5vbkhlbHBlciArICc7ICcgKyBuZXh0U3RhY2sgKyAnID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoJyArIGhlbHBlci5jYWxsUGFyYW1zICsgJykgOiBoZWxwZXI7IH0nKTtcbiAgfSxcblxuICAvLyBbaW52b2tlUGFydGlhbF1cbiAgLy9cbiAgLy8gT24gc3RhY2ssIGJlZm9yZTogY29udGV4dCwgLi4uXG4gIC8vIE9uIHN0YWNrIGFmdGVyOiByZXN1bHQgb2YgcGFydGlhbCBpbnZvY2F0aW9uXG4gIC8vXG4gIC8vIFRoaXMgb3BlcmF0aW9uIHBvcHMgb2ZmIGEgY29udGV4dCwgaW52b2tlcyBhIHBhcnRpYWwgd2l0aCB0aGF0IGNvbnRleHQsXG4gIC8vIGFuZCBwdXNoZXMgdGhlIHJlc3VsdCBvZiB0aGUgaW52b2NhdGlvbiBiYWNrLlxuICBpbnZva2VQYXJ0aWFsOiBmdW5jdGlvbihuYW1lKSB7XG4gICAgdmFyIHBhcmFtcyA9IFt0aGlzLm5hbWVMb29rdXAoJ3BhcnRpYWxzJywgbmFtZSwgJ3BhcnRpYWwnKSwgXCInXCIgKyBuYW1lICsgXCInXCIsIHRoaXMucG9wU3RhY2soKSwgXCJoZWxwZXJzXCIsIFwicGFydGlhbHNcIl07XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLmRhdGEpIHtcbiAgICAgIHBhcmFtcy5wdXNoKFwiZGF0YVwiKTtcbiAgICB9XG5cbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5zZWxmID0gXCJ0aGlzXCI7XG4gICAgdGhpcy5wdXNoKFwic2VsZi5pbnZva2VQYXJ0aWFsKFwiICsgcGFyYW1zLmpvaW4oXCIsIFwiKSArIFwiKVwiKTtcbiAgfSxcblxuICAvLyBbYXNzaWduVG9IYXNoXVxuICAvL1xuICAvLyBPbiBzdGFjaywgYmVmb3JlOiB2YWx1ZSwgaGFzaCwgLi4uXG4gIC8vIE9uIHN0YWNrLCBhZnRlcjogaGFzaCwgLi4uXG4gIC8vXG4gIC8vIFBvcHMgYSB2YWx1ZSBhbmQgaGFzaCBvZmYgdGhlIHN0YWNrLCBhc3NpZ25zIGBoYXNoW2tleV0gPSB2YWx1ZWBcbiAgLy8gYW5kIHB1c2hlcyB0aGUgaGFzaCBiYWNrIG9udG8gdGhlIHN0YWNrLlxuICBhc3NpZ25Ub0hhc2g6IGZ1bmN0aW9uKGtleSkge1xuICAgIHZhciB2YWx1ZSA9IHRoaXMucG9wU3RhY2soKSxcbiAgICAgICAgY29udGV4dCxcbiAgICAgICAgdHlwZTtcblxuICAgIGlmICh0aGlzLm9wdGlvbnMuc3RyaW5nUGFyYW1zKSB7XG4gICAgICB0eXBlID0gdGhpcy5wb3BTdGFjaygpO1xuICAgICAgY29udGV4dCA9IHRoaXMucG9wU3RhY2soKTtcbiAgICB9XG5cbiAgICB2YXIgaGFzaCA9IHRoaXMuaGFzaDtcbiAgICBpZiAoY29udGV4dCkge1xuICAgICAgaGFzaC5jb250ZXh0cy5wdXNoKFwiJ1wiICsga2V5ICsgXCInOiBcIiArIGNvbnRleHQpO1xuICAgIH1cbiAgICBpZiAodHlwZSkge1xuICAgICAgaGFzaC50eXBlcy5wdXNoKFwiJ1wiICsga2V5ICsgXCInOiBcIiArIHR5cGUpO1xuICAgIH1cbiAgICBoYXNoLnZhbHVlcy5wdXNoKFwiJ1wiICsga2V5ICsgXCInOiAoXCIgKyB2YWx1ZSArIFwiKVwiKTtcbiAgfSxcblxuICAvLyBIRUxQRVJTXG5cbiAgY29tcGlsZXI6IEphdmFTY3JpcHRDb21waWxlcixcblxuICBjb21waWxlQ2hpbGRyZW46IGZ1bmN0aW9uKGVudmlyb25tZW50LCBvcHRpb25zKSB7XG4gICAgdmFyIGNoaWxkcmVuID0gZW52aXJvbm1lbnQuY2hpbGRyZW4sIGNoaWxkLCBjb21waWxlcjtcblxuICAgIGZvcih2YXIgaT0wLCBsPWNoaWxkcmVuLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICAgIGNoaWxkID0gY2hpbGRyZW5baV07XG4gICAgICBjb21waWxlciA9IG5ldyB0aGlzLmNvbXBpbGVyKCk7XG5cbiAgICAgIHZhciBpbmRleCA9IHRoaXMubWF0Y2hFeGlzdGluZ1Byb2dyYW0oY2hpbGQpO1xuXG4gICAgICBpZiAoaW5kZXggPT0gbnVsbCkge1xuICAgICAgICB0aGlzLmNvbnRleHQucHJvZ3JhbXMucHVzaCgnJyk7ICAgICAvLyBQbGFjZWhvbGRlciB0byBwcmV2ZW50IG5hbWUgY29uZmxpY3RzIGZvciBuZXN0ZWQgY2hpbGRyZW5cbiAgICAgICAgaW5kZXggPSB0aGlzLmNvbnRleHQucHJvZ3JhbXMubGVuZ3RoO1xuICAgICAgICBjaGlsZC5pbmRleCA9IGluZGV4O1xuICAgICAgICBjaGlsZC5uYW1lID0gJ3Byb2dyYW0nICsgaW5kZXg7XG4gICAgICAgIHRoaXMuY29udGV4dC5wcm9ncmFtc1tpbmRleF0gPSBjb21waWxlci5jb21waWxlKGNoaWxkLCBvcHRpb25zLCB0aGlzLmNvbnRleHQpO1xuICAgICAgICB0aGlzLmNvbnRleHQuZW52aXJvbm1lbnRzW2luZGV4XSA9IGNoaWxkO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY2hpbGQuaW5kZXggPSBpbmRleDtcbiAgICAgICAgY2hpbGQubmFtZSA9ICdwcm9ncmFtJyArIGluZGV4O1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgbWF0Y2hFeGlzdGluZ1Byb2dyYW06IGZ1bmN0aW9uKGNoaWxkKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRoaXMuY29udGV4dC5lbnZpcm9ubWVudHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBlbnZpcm9ubWVudCA9IHRoaXMuY29udGV4dC5lbnZpcm9ubWVudHNbaV07XG4gICAgICBpZiAoZW52aXJvbm1lbnQgJiYgZW52aXJvbm1lbnQuZXF1YWxzKGNoaWxkKSkge1xuICAgICAgICByZXR1cm4gaTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgcHJvZ3JhbUV4cHJlc3Npb246IGZ1bmN0aW9uKGd1aWQpIHtcbiAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5zZWxmID0gXCJ0aGlzXCI7XG5cbiAgICBpZihndWlkID09IG51bGwpIHtcbiAgICAgIHJldHVybiBcInNlbGYubm9vcFwiO1xuICAgIH1cblxuICAgIHZhciBjaGlsZCA9IHRoaXMuZW52aXJvbm1lbnQuY2hpbGRyZW5bZ3VpZF0sXG4gICAgICAgIGRlcHRocyA9IGNoaWxkLmRlcHRocy5saXN0LCBkZXB0aDtcblxuICAgIHZhciBwcm9ncmFtUGFyYW1zID0gW2NoaWxkLmluZGV4LCBjaGlsZC5uYW1lLCBcImRhdGFcIl07XG5cbiAgICBmb3IodmFyIGk9MCwgbCA9IGRlcHRocy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgICBkZXB0aCA9IGRlcHRoc1tpXTtcblxuICAgICAgaWYoZGVwdGggPT09IDEpIHsgcHJvZ3JhbVBhcmFtcy5wdXNoKFwiZGVwdGgwXCIpOyB9XG4gICAgICBlbHNlIHsgcHJvZ3JhbVBhcmFtcy5wdXNoKFwiZGVwdGhcIiArIChkZXB0aCAtIDEpKTsgfVxuICAgIH1cblxuICAgIHJldHVybiAoZGVwdGhzLmxlbmd0aCA9PT0gMCA/IFwic2VsZi5wcm9ncmFtKFwiIDogXCJzZWxmLnByb2dyYW1XaXRoRGVwdGgoXCIpICsgcHJvZ3JhbVBhcmFtcy5qb2luKFwiLCBcIikgKyBcIilcIjtcbiAgfSxcblxuICByZWdpc3RlcjogZnVuY3Rpb24obmFtZSwgdmFsKSB7XG4gICAgdGhpcy51c2VSZWdpc3RlcihuYW1lKTtcbiAgICB0aGlzLnB1c2hTb3VyY2UobmFtZSArIFwiID0gXCIgKyB2YWwgKyBcIjtcIik7XG4gIH0sXG5cbiAgdXNlUmVnaXN0ZXI6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZighdGhpcy5yZWdpc3RlcnNbbmFtZV0pIHtcbiAgICAgIHRoaXMucmVnaXN0ZXJzW25hbWVdID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVnaXN0ZXJzLmxpc3QucHVzaChuYW1lKTtcbiAgICB9XG4gIH0sXG5cbiAgcHVzaFN0YWNrTGl0ZXJhbDogZnVuY3Rpb24oaXRlbSkge1xuICAgIHJldHVybiB0aGlzLnB1c2gobmV3IExpdGVyYWwoaXRlbSkpO1xuICB9LFxuXG4gIHB1c2hTb3VyY2U6IGZ1bmN0aW9uKHNvdXJjZSkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb250ZW50KSB7XG4gICAgICB0aGlzLnNvdXJjZS5wdXNoKHRoaXMuYXBwZW5kVG9CdWZmZXIodGhpcy5xdW90ZWRTdHJpbmcodGhpcy5wZW5kaW5nQ29udGVudCkpKTtcbiAgICAgIHRoaXMucGVuZGluZ0NvbnRlbnQgPSB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgaWYgKHNvdXJjZSkge1xuICAgICAgdGhpcy5zb3VyY2UucHVzaChzb3VyY2UpO1xuICAgIH1cbiAgfSxcblxuICBwdXNoU3RhY2s6IGZ1bmN0aW9uKGl0ZW0pIHtcbiAgICB0aGlzLmZsdXNoSW5saW5lKCk7XG5cbiAgICB2YXIgc3RhY2sgPSB0aGlzLmluY3JTdGFjaygpO1xuICAgIGlmIChpdGVtKSB7XG4gICAgICB0aGlzLnB1c2hTb3VyY2Uoc3RhY2sgKyBcIiA9IFwiICsgaXRlbSArIFwiO1wiKTtcbiAgICB9XG4gICAgdGhpcy5jb21waWxlU3RhY2sucHVzaChzdGFjayk7XG4gICAgcmV0dXJuIHN0YWNrO1xuICB9LFxuXG4gIHJlcGxhY2VTdGFjazogZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB2YXIgcHJlZml4ID0gJycsXG4gICAgICAgIGlubGluZSA9IHRoaXMuaXNJbmxpbmUoKSxcbiAgICAgICAgc3RhY2ssXG4gICAgICAgIGNyZWF0ZWRTdGFjayxcbiAgICAgICAgdXNlZExpdGVyYWw7XG5cbiAgICAvLyBJZiB3ZSBhcmUgY3VycmVudGx5IGlubGluZSB0aGVuIHdlIHdhbnQgdG8gbWVyZ2UgdGhlIGlubGluZSBzdGF0ZW1lbnQgaW50byB0aGVcbiAgICAvLyByZXBsYWNlbWVudCBzdGF0ZW1lbnQgdmlhICcsJ1xuICAgIGlmIChpbmxpbmUpIHtcbiAgICAgIHZhciB0b3AgPSB0aGlzLnBvcFN0YWNrKHRydWUpO1xuXG4gICAgICBpZiAodG9wIGluc3RhbmNlb2YgTGl0ZXJhbCkge1xuICAgICAgICAvLyBMaXRlcmFscyBkbyBub3QgbmVlZCB0byBiZSBpbmxpbmVkXG4gICAgICAgIHN0YWNrID0gdG9wLnZhbHVlO1xuICAgICAgICB1c2VkTGl0ZXJhbCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBHZXQgb3IgY3JlYXRlIHRoZSBjdXJyZW50IHN0YWNrIG5hbWUgZm9yIHVzZSBieSB0aGUgaW5saW5lXG4gICAgICAgIGNyZWF0ZWRTdGFjayA9ICF0aGlzLnN0YWNrU2xvdDtcbiAgICAgICAgdmFyIG5hbWUgPSAhY3JlYXRlZFN0YWNrID8gdGhpcy50b3BTdGFja05hbWUoKSA6IHRoaXMuaW5jclN0YWNrKCk7XG5cbiAgICAgICAgcHJlZml4ID0gJygnICsgdGhpcy5wdXNoKG5hbWUpICsgJyA9ICcgKyB0b3AgKyAnKSwnO1xuICAgICAgICBzdGFjayA9IHRoaXMudG9wU3RhY2soKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgc3RhY2sgPSB0aGlzLnRvcFN0YWNrKCk7XG4gICAgfVxuXG4gICAgdmFyIGl0ZW0gPSBjYWxsYmFjay5jYWxsKHRoaXMsIHN0YWNrKTtcblxuICAgIGlmIChpbmxpbmUpIHtcbiAgICAgIGlmICghdXNlZExpdGVyYWwpIHtcbiAgICAgICAgdGhpcy5wb3BTdGFjaygpO1xuICAgICAgfVxuICAgICAgaWYgKGNyZWF0ZWRTdGFjaykge1xuICAgICAgICB0aGlzLnN0YWNrU2xvdC0tO1xuICAgICAgfVxuICAgICAgdGhpcy5wdXNoKCcoJyArIHByZWZpeCArIGl0ZW0gKyAnKScpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBQcmV2ZW50IG1vZGlmaWNhdGlvbiBvZiB0aGUgY29udGV4dCBkZXB0aCB2YXJpYWJsZS4gVGhyb3VnaCByZXBsYWNlU3RhY2tcbiAgICAgIGlmICghL15zdGFjay8udGVzdChzdGFjaykpIHtcbiAgICAgICAgc3RhY2sgPSB0aGlzLm5leHRTdGFjaygpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLnB1c2hTb3VyY2Uoc3RhY2sgKyBcIiA9IChcIiArIHByZWZpeCArIGl0ZW0gKyBcIik7XCIpO1xuICAgIH1cbiAgICByZXR1cm4gc3RhY2s7XG4gIH0sXG5cbiAgbmV4dFN0YWNrOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gdGhpcy5wdXNoU3RhY2soKTtcbiAgfSxcblxuICBpbmNyU3RhY2s6IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3RhY2tTbG90Kys7XG4gICAgaWYodGhpcy5zdGFja1Nsb3QgPiB0aGlzLnN0YWNrVmFycy5sZW5ndGgpIHsgdGhpcy5zdGFja1ZhcnMucHVzaChcInN0YWNrXCIgKyB0aGlzLnN0YWNrU2xvdCk7IH1cbiAgICByZXR1cm4gdGhpcy50b3BTdGFja05hbWUoKTtcbiAgfSxcbiAgdG9wU3RhY2tOYW1lOiBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXCJzdGFja1wiICsgdGhpcy5zdGFja1Nsb3Q7XG4gIH0sXG4gIGZsdXNoSW5saW5lOiBmdW5jdGlvbigpIHtcbiAgICB2YXIgaW5saW5lU3RhY2sgPSB0aGlzLmlubGluZVN0YWNrO1xuICAgIGlmIChpbmxpbmVTdGFjay5sZW5ndGgpIHtcbiAgICAgIHRoaXMuaW5saW5lU3RhY2sgPSBbXTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBpbmxpbmVTdGFjay5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICB2YXIgZW50cnkgPSBpbmxpbmVTdGFja1tpXTtcbiAgICAgICAgaWYgKGVudHJ5IGluc3RhbmNlb2YgTGl0ZXJhbCkge1xuICAgICAgICAgIHRoaXMuY29tcGlsZVN0YWNrLnB1c2goZW50cnkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRoaXMucHVzaFN0YWNrKGVudHJ5KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgaXNJbmxpbmU6IGZ1bmN0aW9uKCkge1xuICAgIHJldHVybiB0aGlzLmlubGluZVN0YWNrLmxlbmd0aDtcbiAgfSxcblxuICBwb3BTdGFjazogZnVuY3Rpb24od3JhcHBlZCkge1xuICAgIHZhciBpbmxpbmUgPSB0aGlzLmlzSW5saW5lKCksXG4gICAgICAgIGl0ZW0gPSAoaW5saW5lID8gdGhpcy5pbmxpbmVTdGFjayA6IHRoaXMuY29tcGlsZVN0YWNrKS5wb3AoKTtcblxuICAgIGlmICghd3JhcHBlZCAmJiAoaXRlbSBpbnN0YW5jZW9mIExpdGVyYWwpKSB7XG4gICAgICByZXR1cm4gaXRlbS52YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKCFpbmxpbmUpIHtcbiAgICAgICAgaWYgKCF0aGlzLnN0YWNrU2xvdCkge1xuICAgICAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oJ0ludmFsaWQgc3RhY2sgcG9wJyk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGFja1Nsb3QtLTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH1cbiAgfSxcblxuICB0b3BTdGFjazogZnVuY3Rpb24od3JhcHBlZCkge1xuICAgIHZhciBzdGFjayA9ICh0aGlzLmlzSW5saW5lKCkgPyB0aGlzLmlubGluZVN0YWNrIDogdGhpcy5jb21waWxlU3RhY2spLFxuICAgICAgICBpdGVtID0gc3RhY2tbc3RhY2subGVuZ3RoIC0gMV07XG5cbiAgICBpZiAoIXdyYXBwZWQgJiYgKGl0ZW0gaW5zdGFuY2VvZiBMaXRlcmFsKSkge1xuICAgICAgcmV0dXJuIGl0ZW0udmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBpdGVtO1xuICAgIH1cbiAgfSxcblxuICBxdW90ZWRTdHJpbmc6IGZ1bmN0aW9uKHN0cikge1xuICAgIHJldHVybiAnXCInICsgc3RyXG4gICAgICAucmVwbGFjZSgvXFxcXC9nLCAnXFxcXFxcXFwnKVxuICAgICAgLnJlcGxhY2UoL1wiL2csICdcXFxcXCInKVxuICAgICAgLnJlcGxhY2UoL1xcbi9nLCAnXFxcXG4nKVxuICAgICAgLnJlcGxhY2UoL1xcci9nLCAnXFxcXHInKVxuICAgICAgLnJlcGxhY2UoL1xcdTIwMjgvZywgJ1xcXFx1MjAyOCcpICAgLy8gUGVyIEVjbWEtMjYyIDcuMyArIDcuOC40XG4gICAgICAucmVwbGFjZSgvXFx1MjAyOS9nLCAnXFxcXHUyMDI5JykgKyAnXCInO1xuICB9LFxuXG4gIHNldHVwSGVscGVyOiBmdW5jdGlvbihwYXJhbVNpemUsIG5hbWUsIG1pc3NpbmdQYXJhbXMpIHtcbiAgICB2YXIgcGFyYW1zID0gW10sXG4gICAgICAgIHBhcmFtc0luaXQgPSB0aGlzLnNldHVwUGFyYW1zKHBhcmFtU2l6ZSwgcGFyYW1zLCBtaXNzaW5nUGFyYW1zKTtcbiAgICB2YXIgZm91bmRIZWxwZXIgPSB0aGlzLm5hbWVMb29rdXAoJ2hlbHBlcnMnLCBuYW1lLCAnaGVscGVyJyk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgcGFyYW1zOiBwYXJhbXMsXG4gICAgICBwYXJhbXNJbml0OiBwYXJhbXNJbml0LFxuICAgICAgbmFtZTogZm91bmRIZWxwZXIsXG4gICAgICBjYWxsUGFyYW1zOiBbXCJkZXB0aDBcIl0uY29uY2F0KHBhcmFtcykuam9pbihcIiwgXCIpLFxuICAgICAgaGVscGVyTWlzc2luZ1BhcmFtczogbWlzc2luZ1BhcmFtcyAmJiBbXCJkZXB0aDBcIiwgdGhpcy5xdW90ZWRTdHJpbmcobmFtZSldLmNvbmNhdChwYXJhbXMpLmpvaW4oXCIsIFwiKVxuICAgIH07XG4gIH0sXG5cbiAgc2V0dXBPcHRpb25zOiBmdW5jdGlvbihwYXJhbVNpemUsIHBhcmFtcykge1xuICAgIHZhciBvcHRpb25zID0gW10sIGNvbnRleHRzID0gW10sIHR5cGVzID0gW10sIHBhcmFtLCBpbnZlcnNlLCBwcm9ncmFtO1xuXG4gICAgb3B0aW9ucy5wdXNoKFwiaGFzaDpcIiArIHRoaXMucG9wU3RhY2soKSk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25zLnN0cmluZ1BhcmFtcykge1xuICAgICAgb3B0aW9ucy5wdXNoKFwiaGFzaFR5cGVzOlwiICsgdGhpcy5wb3BTdGFjaygpKTtcbiAgICAgIG9wdGlvbnMucHVzaChcImhhc2hDb250ZXh0czpcIiArIHRoaXMucG9wU3RhY2soKSk7XG4gICAgfVxuXG4gICAgaW52ZXJzZSA9IHRoaXMucG9wU3RhY2soKTtcbiAgICBwcm9ncmFtID0gdGhpcy5wb3BTdGFjaygpO1xuXG4gICAgLy8gQXZvaWQgc2V0dGluZyBmbiBhbmQgaW52ZXJzZSBpZiBuZWl0aGVyIGFyZSBzZXQuIFRoaXMgYWxsb3dzXG4gICAgLy8gaGVscGVycyB0byBkbyBhIGNoZWNrIGZvciBgaWYgKG9wdGlvbnMuZm4pYFxuICAgIGlmIChwcm9ncmFtIHx8IGludmVyc2UpIHtcbiAgICAgIGlmICghcHJvZ3JhbSkge1xuICAgICAgICB0aGlzLmNvbnRleHQuYWxpYXNlcy5zZWxmID0gXCJ0aGlzXCI7XG4gICAgICAgIHByb2dyYW0gPSBcInNlbGYubm9vcFwiO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWludmVyc2UpIHtcbiAgICAgICAgdGhpcy5jb250ZXh0LmFsaWFzZXMuc2VsZiA9IFwidGhpc1wiO1xuICAgICAgICBpbnZlcnNlID0gXCJzZWxmLm5vb3BcIjtcbiAgICAgIH1cblxuICAgICAgb3B0aW9ucy5wdXNoKFwiaW52ZXJzZTpcIiArIGludmVyc2UpO1xuICAgICAgb3B0aW9ucy5wdXNoKFwiZm46XCIgKyBwcm9ncmFtKTtcbiAgICB9XG5cbiAgICBmb3IodmFyIGk9MDsgaTxwYXJhbVNpemU7IGkrKykge1xuICAgICAgcGFyYW0gPSB0aGlzLnBvcFN0YWNrKCk7XG4gICAgICBwYXJhbXMucHVzaChwYXJhbSk7XG5cbiAgICAgIGlmKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgICAgdHlwZXMucHVzaCh0aGlzLnBvcFN0YWNrKCkpO1xuICAgICAgICBjb250ZXh0cy5wdXNoKHRoaXMucG9wU3RhY2soKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMub3B0aW9ucy5zdHJpbmdQYXJhbXMpIHtcbiAgICAgIG9wdGlvbnMucHVzaChcImNvbnRleHRzOltcIiArIGNvbnRleHRzLmpvaW4oXCIsXCIpICsgXCJdXCIpO1xuICAgICAgb3B0aW9ucy5wdXNoKFwidHlwZXM6W1wiICsgdHlwZXMuam9pbihcIixcIikgKyBcIl1cIik7XG4gICAgfVxuXG4gICAgaWYodGhpcy5vcHRpb25zLmRhdGEpIHtcbiAgICAgIG9wdGlvbnMucHVzaChcImRhdGE6ZGF0YVwiKTtcbiAgICB9XG5cbiAgICByZXR1cm4gb3B0aW9ucztcbiAgfSxcblxuICAvLyB0aGUgcGFyYW1zIGFuZCBjb250ZXh0cyBhcmd1bWVudHMgYXJlIHBhc3NlZCBpbiBhcnJheXNcbiAgLy8gdG8gZmlsbCBpblxuICBzZXR1cFBhcmFtczogZnVuY3Rpb24ocGFyYW1TaXplLCBwYXJhbXMsIHVzZVJlZ2lzdGVyKSB7XG4gICAgdmFyIG9wdGlvbnMgPSAneycgKyB0aGlzLnNldHVwT3B0aW9ucyhwYXJhbVNpemUsIHBhcmFtcykuam9pbignLCcpICsgJ30nO1xuXG4gICAgaWYgKHVzZVJlZ2lzdGVyKSB7XG4gICAgICB0aGlzLnVzZVJlZ2lzdGVyKCdvcHRpb25zJyk7XG4gICAgICBwYXJhbXMucHVzaCgnb3B0aW9ucycpO1xuICAgICAgcmV0dXJuICdvcHRpb25zPScgKyBvcHRpb25zO1xuICAgIH0gZWxzZSB7XG4gICAgICBwYXJhbXMucHVzaChvcHRpb25zKTtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cbn07XG5cbnZhciByZXNlcnZlZFdvcmRzID0gKFxuICBcImJyZWFrIGVsc2UgbmV3IHZhclwiICtcbiAgXCIgY2FzZSBmaW5hbGx5IHJldHVybiB2b2lkXCIgK1xuICBcIiBjYXRjaCBmb3Igc3dpdGNoIHdoaWxlXCIgK1xuICBcIiBjb250aW51ZSBmdW5jdGlvbiB0aGlzIHdpdGhcIiArXG4gIFwiIGRlZmF1bHQgaWYgdGhyb3dcIiArXG4gIFwiIGRlbGV0ZSBpbiB0cnlcIiArXG4gIFwiIGRvIGluc3RhbmNlb2YgdHlwZW9mXCIgK1xuICBcIiBhYnN0cmFjdCBlbnVtIGludCBzaG9ydFwiICtcbiAgXCIgYm9vbGVhbiBleHBvcnQgaW50ZXJmYWNlIHN0YXRpY1wiICtcbiAgXCIgYnl0ZSBleHRlbmRzIGxvbmcgc3VwZXJcIiArXG4gIFwiIGNoYXIgZmluYWwgbmF0aXZlIHN5bmNocm9uaXplZFwiICtcbiAgXCIgY2xhc3MgZmxvYXQgcGFja2FnZSB0aHJvd3NcIiArXG4gIFwiIGNvbnN0IGdvdG8gcHJpdmF0ZSB0cmFuc2llbnRcIiArXG4gIFwiIGRlYnVnZ2VyIGltcGxlbWVudHMgcHJvdGVjdGVkIHZvbGF0aWxlXCIgK1xuICBcIiBkb3VibGUgaW1wb3J0IHB1YmxpYyBsZXQgeWllbGRcIlxuKS5zcGxpdChcIiBcIik7XG5cbnZhciBjb21waWxlcldvcmRzID0gSmF2YVNjcmlwdENvbXBpbGVyLlJFU0VSVkVEX1dPUkRTID0ge307XG5cbmZvcih2YXIgaT0wLCBsPXJlc2VydmVkV29yZHMubGVuZ3RoOyBpPGw7IGkrKykge1xuICBjb21waWxlcldvcmRzW3Jlc2VydmVkV29yZHNbaV1dID0gdHJ1ZTtcbn1cblxuSmF2YVNjcmlwdENvbXBpbGVyLmlzVmFsaWRKYXZhU2NyaXB0VmFyaWFibGVOYW1lID0gZnVuY3Rpb24obmFtZSkge1xuICBpZighSmF2YVNjcmlwdENvbXBpbGVyLlJFU0VSVkVEX1dPUkRTW25hbWVdICYmIC9eW2EtekEtWl8kXVswLTlhLXpBLVpfJF0qJC8udGVzdChuYW1lKSkge1xuICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn07XG5cbmV4cG9ydHNbXCJkZWZhdWx0XCJdID0gSmF2YVNjcmlwdENvbXBpbGVyOyIsIlwidXNlIHN0cmljdFwiO1xuLyoganNoaW50IGlnbm9yZTpzdGFydCAqL1xuLyogSmlzb24gZ2VuZXJhdGVkIHBhcnNlciAqL1xudmFyIGhhbmRsZWJhcnMgPSAoZnVuY3Rpb24oKXtcbnZhciBwYXJzZXIgPSB7dHJhY2U6IGZ1bmN0aW9uIHRyYWNlKCkgeyB9LFxueXk6IHt9LFxuc3ltYm9sc186IHtcImVycm9yXCI6MixcInJvb3RcIjozLFwic3RhdGVtZW50c1wiOjQsXCJFT0ZcIjo1LFwicHJvZ3JhbVwiOjYsXCJzaW1wbGVJbnZlcnNlXCI6NyxcInN0YXRlbWVudFwiOjgsXCJvcGVuSW52ZXJzZVwiOjksXCJjbG9zZUJsb2NrXCI6MTAsXCJvcGVuQmxvY2tcIjoxMSxcIm11c3RhY2hlXCI6MTIsXCJwYXJ0aWFsXCI6MTMsXCJDT05URU5UXCI6MTQsXCJDT01NRU5UXCI6MTUsXCJPUEVOX0JMT0NLXCI6MTYsXCJzZXhwclwiOjE3LFwiQ0xPU0VcIjoxOCxcIk9QRU5fSU5WRVJTRVwiOjE5LFwiT1BFTl9FTkRCTE9DS1wiOjIwLFwicGF0aFwiOjIxLFwiT1BFTlwiOjIyLFwiT1BFTl9VTkVTQ0FQRURcIjoyMyxcIkNMT1NFX1VORVNDQVBFRFwiOjI0LFwiT1BFTl9QQVJUSUFMXCI6MjUsXCJwYXJ0aWFsTmFtZVwiOjI2LFwicGFydGlhbF9vcHRpb24wXCI6MjcsXCJzZXhwcl9yZXBldGl0aW9uMFwiOjI4LFwic2V4cHJfb3B0aW9uMFwiOjI5LFwiZGF0YU5hbWVcIjozMCxcInBhcmFtXCI6MzEsXCJTVFJJTkdcIjozMixcIklOVEVHRVJcIjozMyxcIkJPT0xFQU5cIjozNCxcIk9QRU5fU0VYUFJcIjozNSxcIkNMT1NFX1NFWFBSXCI6MzYsXCJoYXNoXCI6MzcsXCJoYXNoX3JlcGV0aXRpb25fcGx1czBcIjozOCxcImhhc2hTZWdtZW50XCI6MzksXCJJRFwiOjQwLFwiRVFVQUxTXCI6NDEsXCJEQVRBXCI6NDIsXCJwYXRoU2VnbWVudHNcIjo0MyxcIlNFUFwiOjQ0LFwiJGFjY2VwdFwiOjAsXCIkZW5kXCI6MX0sXG50ZXJtaW5hbHNfOiB7MjpcImVycm9yXCIsNTpcIkVPRlwiLDE0OlwiQ09OVEVOVFwiLDE1OlwiQ09NTUVOVFwiLDE2OlwiT1BFTl9CTE9DS1wiLDE4OlwiQ0xPU0VcIiwxOTpcIk9QRU5fSU5WRVJTRVwiLDIwOlwiT1BFTl9FTkRCTE9DS1wiLDIyOlwiT1BFTlwiLDIzOlwiT1BFTl9VTkVTQ0FQRURcIiwyNDpcIkNMT1NFX1VORVNDQVBFRFwiLDI1OlwiT1BFTl9QQVJUSUFMXCIsMzI6XCJTVFJJTkdcIiwzMzpcIklOVEVHRVJcIiwzNDpcIkJPT0xFQU5cIiwzNTpcIk9QRU5fU0VYUFJcIiwzNjpcIkNMT1NFX1NFWFBSXCIsNDA6XCJJRFwiLDQxOlwiRVFVQUxTXCIsNDI6XCJEQVRBXCIsNDQ6XCJTRVBcIn0sXG5wcm9kdWN0aW9uc186IFswLFszLDJdLFszLDFdLFs2LDJdLFs2LDNdLFs2LDJdLFs2LDFdLFs2LDFdLFs2LDBdLFs0LDFdLFs0LDJdLFs4LDNdLFs4LDNdLFs4LDFdLFs4LDFdLFs4LDFdLFs4LDFdLFsxMSwzXSxbOSwzXSxbMTAsM10sWzEyLDNdLFsxMiwzXSxbMTMsNF0sWzcsMl0sWzE3LDNdLFsxNywxXSxbMzEsMV0sWzMxLDFdLFszMSwxXSxbMzEsMV0sWzMxLDFdLFszMSwzXSxbMzcsMV0sWzM5LDNdLFsyNiwxXSxbMjYsMV0sWzI2LDFdLFszMCwyXSxbMjEsMV0sWzQzLDNdLFs0MywxXSxbMjcsMF0sWzI3LDFdLFsyOCwwXSxbMjgsMl0sWzI5LDBdLFsyOSwxXSxbMzgsMV0sWzM4LDJdXSxcbnBlcmZvcm1BY3Rpb246IGZ1bmN0aW9uIGFub255bW91cyh5eXRleHQseXlsZW5nLHl5bGluZW5vLHl5LHl5c3RhdGUsJCQsXyQpIHtcblxudmFyICQwID0gJCQubGVuZ3RoIC0gMTtcbnN3aXRjaCAoeXlzdGF0ZSkge1xuY2FzZSAxOiByZXR1cm4gbmV3IHl5LlByb2dyYW1Ob2RlKCQkWyQwLTFdLCB0aGlzLl8kKTsgXG5icmVhaztcbmNhc2UgMjogcmV0dXJuIG5ldyB5eS5Qcm9ncmFtTm9kZShbXSwgdGhpcy5fJCk7IFxuYnJlYWs7XG5jYXNlIDM6dGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKFtdLCAkJFskMC0xXSwgJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSA0OnRoaXMuJCA9IG5ldyB5eS5Qcm9ncmFtTm9kZSgkJFskMC0yXSwgJCRbJDAtMV0sICQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgNTp0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoJCRbJDAtMV0sICQkWyQwXSwgW10sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDY6dGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgNzp0aGlzLiQgPSBuZXcgeXkuUHJvZ3JhbU5vZGUoW10sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDg6dGhpcy4kID0gbmV3IHl5LlByb2dyYW1Ob2RlKFtdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSA5OnRoaXMuJCA9IFskJFskMF1dO1xuYnJlYWs7XG5jYXNlIDEwOiAkJFskMC0xXS5wdXNoKCQkWyQwXSk7IHRoaXMuJCA9ICQkWyQwLTFdOyBcbmJyZWFrO1xuY2FzZSAxMTp0aGlzLiQgPSBuZXcgeXkuQmxvY2tOb2RlKCQkWyQwLTJdLCAkJFskMC0xXS5pbnZlcnNlLCAkJFskMC0xXSwgJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxMjp0aGlzLiQgPSBuZXcgeXkuQmxvY2tOb2RlKCQkWyQwLTJdLCAkJFskMC0xXSwgJCRbJDAtMV0uaW52ZXJzZSwgJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxMzp0aGlzLiQgPSAkJFskMF07XG5icmVhaztcbmNhc2UgMTQ6dGhpcy4kID0gJCRbJDBdO1xuYnJlYWs7XG5jYXNlIDE1OnRoaXMuJCA9IG5ldyB5eS5Db250ZW50Tm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDE2OnRoaXMuJCA9IG5ldyB5eS5Db21tZW50Tm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDE3OnRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV0sIG51bGwsICQkWyQwLTJdLCBzdHJpcEZsYWdzKCQkWyQwLTJdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAxODp0aGlzLiQgPSBuZXcgeXkuTXVzdGFjaGVOb2RlKCQkWyQwLTFdLCBudWxsLCAkJFskMC0yXSwgc3RyaXBGbGFncygkJFskMC0yXSwgJCRbJDBdKSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMTk6dGhpcy4kID0ge3BhdGg6ICQkWyQwLTFdLCBzdHJpcDogc3RyaXBGbGFncygkJFskMC0yXSwgJCRbJDBdKX07XG5icmVhaztcbmNhc2UgMjA6dGhpcy4kID0gbmV3IHl5Lk11c3RhY2hlTm9kZSgkJFskMC0xXSwgbnVsbCwgJCRbJDAtMl0sIHN0cmlwRmxhZ3MoJCRbJDAtMl0sICQkWyQwXSksIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDIxOnRoaXMuJCA9IG5ldyB5eS5NdXN0YWNoZU5vZGUoJCRbJDAtMV0sIG51bGwsICQkWyQwLTJdLCBzdHJpcEZsYWdzKCQkWyQwLTJdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyMjp0aGlzLiQgPSBuZXcgeXkuUGFydGlhbE5vZGUoJCRbJDAtMl0sICQkWyQwLTFdLCBzdHJpcEZsYWdzKCQkWyQwLTNdLCAkJFskMF0pLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAyMzp0aGlzLiQgPSBzdHJpcEZsYWdzKCQkWyQwLTFdLCAkJFskMF0pO1xuYnJlYWs7XG5jYXNlIDI0OnRoaXMuJCA9IG5ldyB5eS5TZXhwck5vZGUoWyQkWyQwLTJdXS5jb25jYXQoJCRbJDAtMV0pLCAkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDI1OnRoaXMuJCA9IG5ldyB5eS5TZXhwck5vZGUoWyQkWyQwXV0sIG51bGwsIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDI2OnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSAyNzp0aGlzLiQgPSBuZXcgeXkuU3RyaW5nTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDI4OnRoaXMuJCA9IG5ldyB5eS5JbnRlZ2VyTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDI5OnRoaXMuJCA9IG5ldyB5eS5Cb29sZWFuTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDMwOnRoaXMuJCA9ICQkWyQwXTtcbmJyZWFrO1xuY2FzZSAzMTokJFskMC0xXS5pc0hlbHBlciA9IHRydWU7IHRoaXMuJCA9ICQkWyQwLTFdO1xuYnJlYWs7XG5jYXNlIDMyOnRoaXMuJCA9IG5ldyB5eS5IYXNoTm9kZSgkJFskMF0sIHRoaXMuXyQpO1xuYnJlYWs7XG5jYXNlIDMzOnRoaXMuJCA9IFskJFskMC0yXSwgJCRbJDBdXTtcbmJyZWFrO1xuY2FzZSAzNDp0aGlzLiQgPSBuZXcgeXkuUGFydGlhbE5hbWVOb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzU6dGhpcy4kID0gbmV3IHl5LlBhcnRpYWxOYW1lTm9kZShuZXcgeXkuU3RyaW5nTm9kZSgkJFskMF0sIHRoaXMuXyQpLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzNjp0aGlzLiQgPSBuZXcgeXkuUGFydGlhbE5hbWVOb2RlKG5ldyB5eS5JbnRlZ2VyTm9kZSgkJFskMF0sIHRoaXMuXyQpKTtcbmJyZWFrO1xuY2FzZSAzNzp0aGlzLiQgPSBuZXcgeXkuRGF0YU5vZGUoJCRbJDBdLCB0aGlzLl8kKTtcbmJyZWFrO1xuY2FzZSAzODp0aGlzLiQgPSBuZXcgeXkuSWROb2RlKCQkWyQwXSwgdGhpcy5fJCk7XG5icmVhaztcbmNhc2UgMzk6ICQkWyQwLTJdLnB1c2goe3BhcnQ6ICQkWyQwXSwgc2VwYXJhdG9yOiAkJFskMC0xXX0pOyB0aGlzLiQgPSAkJFskMC0yXTsgXG5icmVhaztcbmNhc2UgNDA6dGhpcy4kID0gW3twYXJ0OiAkJFskMF19XTtcbmJyZWFrO1xuY2FzZSA0Mzp0aGlzLiQgPSBbXTtcbmJyZWFrO1xuY2FzZSA0NDokJFskMC0xXS5wdXNoKCQkWyQwXSk7XG5icmVhaztcbmNhc2UgNDc6dGhpcy4kID0gWyQkWyQwXV07XG5icmVhaztcbmNhc2UgNDg6JCRbJDAtMV0ucHVzaCgkJFskMF0pO1xuYnJlYWs7XG59XG59LFxudGFibGU6IFt7MzoxLDQ6Miw1OlsxLDNdLDg6NCw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwxMV0sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHsxOlszXX0sezU6WzEsMTZdLDg6MTcsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMTFdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7MTpbMiwyXX0sezU6WzIsOV0sMTQ6WzIsOV0sMTU6WzIsOV0sMTY6WzIsOV0sMTk6WzIsOV0sMjA6WzIsOV0sMjI6WzIsOV0sMjM6WzIsOV0sMjU6WzIsOV19LHs0OjIwLDY6MTgsNzoxOSw4OjQsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMjFdLDIwOlsyLDhdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7NDoyMCw2OjIyLDc6MTksODo0LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDIxXSwyMDpbMiw4XSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezU6WzIsMTNdLDE0OlsyLDEzXSwxNTpbMiwxM10sMTY6WzIsMTNdLDE5OlsyLDEzXSwyMDpbMiwxM10sMjI6WzIsMTNdLDIzOlsyLDEzXSwyNTpbMiwxM119LHs1OlsyLDE0XSwxNDpbMiwxNF0sMTU6WzIsMTRdLDE2OlsyLDE0XSwxOTpbMiwxNF0sMjA6WzIsMTRdLDIyOlsyLDE0XSwyMzpbMiwxNF0sMjU6WzIsMTRdfSx7NTpbMiwxNV0sMTQ6WzIsMTVdLDE1OlsyLDE1XSwxNjpbMiwxNV0sMTk6WzIsMTVdLDIwOlsyLDE1XSwyMjpbMiwxNV0sMjM6WzIsMTVdLDI1OlsyLDE1XX0sezU6WzIsMTZdLDE0OlsyLDE2XSwxNTpbMiwxNl0sMTY6WzIsMTZdLDE5OlsyLDE2XSwyMDpbMiwxNl0sMjI6WzIsMTZdLDIzOlsyLDE2XSwyNTpbMiwxNl19LHsxNzoyMywyMToyNCwzMDoyNSw0MDpbMSwyOF0sNDI6WzEsMjddLDQzOjI2fSx7MTc6MjksMjE6MjQsMzA6MjUsNDA6WzEsMjhdLDQyOlsxLDI3XSw0MzoyNn0sezE3OjMwLDIxOjI0LDMwOjI1LDQwOlsxLDI4XSw0MjpbMSwyN10sNDM6MjZ9LHsxNzozMSwyMToyNCwzMDoyNSw0MDpbMSwyOF0sNDI6WzEsMjddLDQzOjI2fSx7MjE6MzMsMjY6MzIsMzI6WzEsMzRdLDMzOlsxLDM1XSw0MDpbMSwyOF0sNDM6MjZ9LHsxOlsyLDFdfSx7NTpbMiwxMF0sMTQ6WzIsMTBdLDE1OlsyLDEwXSwxNjpbMiwxMF0sMTk6WzIsMTBdLDIwOlsyLDEwXSwyMjpbMiwxMF0sMjM6WzIsMTBdLDI1OlsyLDEwXX0sezEwOjM2LDIwOlsxLDM3XX0sezQ6MzgsODo0LDk6NSwxMTo2LDEyOjcsMTM6OCwxNDpbMSw5XSwxNTpbMSwxMF0sMTY6WzEsMTJdLDE5OlsxLDExXSwyMDpbMiw3XSwyMjpbMSwxM10sMjM6WzEsMTRdLDI1OlsxLDE1XX0sezc6MzksODoxNyw5OjUsMTE6NiwxMjo3LDEzOjgsMTQ6WzEsOV0sMTU6WzEsMTBdLDE2OlsxLDEyXSwxOTpbMSwyMV0sMjA6WzIsNl0sMjI6WzEsMTNdLDIzOlsxLDE0XSwyNTpbMSwxNV19LHsxNzoyMywxODpbMSw0MF0sMjE6MjQsMzA6MjUsNDA6WzEsMjhdLDQyOlsxLDI3XSw0MzoyNn0sezEwOjQxLDIwOlsxLDM3XX0sezE4OlsxLDQyXX0sezE4OlsyLDQzXSwyNDpbMiw0M10sMjg6NDMsMzI6WzIsNDNdLDMzOlsyLDQzXSwzNDpbMiw0M10sMzU6WzIsNDNdLDM2OlsyLDQzXSw0MDpbMiw0M10sNDI6WzIsNDNdfSx7MTg6WzIsMjVdLDI0OlsyLDI1XSwzNjpbMiwyNV19LHsxODpbMiwzOF0sMjQ6WzIsMzhdLDMyOlsyLDM4XSwzMzpbMiwzOF0sMzQ6WzIsMzhdLDM1OlsyLDM4XSwzNjpbMiwzOF0sNDA6WzIsMzhdLDQyOlsyLDM4XSw0NDpbMSw0NF19LHsyMTo0NSw0MDpbMSwyOF0sNDM6MjZ9LHsxODpbMiw0MF0sMjQ6WzIsNDBdLDMyOlsyLDQwXSwzMzpbMiw0MF0sMzQ6WzIsNDBdLDM1OlsyLDQwXSwzNjpbMiw0MF0sNDA6WzIsNDBdLDQyOlsyLDQwXSw0NDpbMiw0MF19LHsxODpbMSw0Nl19LHsxODpbMSw0N119LHsyNDpbMSw0OF19LHsxODpbMiw0MV0sMjE6NTAsMjc6NDksNDA6WzEsMjhdLDQzOjI2fSx7MTg6WzIsMzRdLDQwOlsyLDM0XX0sezE4OlsyLDM1XSw0MDpbMiwzNV19LHsxODpbMiwzNl0sNDA6WzIsMzZdfSx7NTpbMiwxMV0sMTQ6WzIsMTFdLDE1OlsyLDExXSwxNjpbMiwxMV0sMTk6WzIsMTFdLDIwOlsyLDExXSwyMjpbMiwxMV0sMjM6WzIsMTFdLDI1OlsyLDExXX0sezIxOjUxLDQwOlsxLDI4XSw0MzoyNn0sezg6MTcsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMTFdLDIwOlsyLDNdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7NDo1Miw4OjQsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMTFdLDIwOlsyLDVdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7MTQ6WzIsMjNdLDE1OlsyLDIzXSwxNjpbMiwyM10sMTk6WzIsMjNdLDIwOlsyLDIzXSwyMjpbMiwyM10sMjM6WzIsMjNdLDI1OlsyLDIzXX0sezU6WzIsMTJdLDE0OlsyLDEyXSwxNTpbMiwxMl0sMTY6WzIsMTJdLDE5OlsyLDEyXSwyMDpbMiwxMl0sMjI6WzIsMTJdLDIzOlsyLDEyXSwyNTpbMiwxMl19LHsxNDpbMiwxOF0sMTU6WzIsMThdLDE2OlsyLDE4XSwxOTpbMiwxOF0sMjA6WzIsMThdLDIyOlsyLDE4XSwyMzpbMiwxOF0sMjU6WzIsMThdfSx7MTg6WzIsNDVdLDIxOjU2LDI0OlsyLDQ1XSwyOTo1MywzMDo2MCwzMTo1NCwzMjpbMSw1N10sMzM6WzEsNThdLDM0OlsxLDU5XSwzNTpbMSw2MV0sMzY6WzIsNDVdLDM3OjU1LDM4OjYyLDM5OjYzLDQwOlsxLDY0XSw0MjpbMSwyN10sNDM6MjZ9LHs0MDpbMSw2NV19LHsxODpbMiwzN10sMjQ6WzIsMzddLDMyOlsyLDM3XSwzMzpbMiwzN10sMzQ6WzIsMzddLDM1OlsyLDM3XSwzNjpbMiwzN10sNDA6WzIsMzddLDQyOlsyLDM3XX0sezE0OlsyLDE3XSwxNTpbMiwxN10sMTY6WzIsMTddLDE5OlsyLDE3XSwyMDpbMiwxN10sMjI6WzIsMTddLDIzOlsyLDE3XSwyNTpbMiwxN119LHs1OlsyLDIwXSwxNDpbMiwyMF0sMTU6WzIsMjBdLDE2OlsyLDIwXSwxOTpbMiwyMF0sMjA6WzIsMjBdLDIyOlsyLDIwXSwyMzpbMiwyMF0sMjU6WzIsMjBdfSx7NTpbMiwyMV0sMTQ6WzIsMjFdLDE1OlsyLDIxXSwxNjpbMiwyMV0sMTk6WzIsMjFdLDIwOlsyLDIxXSwyMjpbMiwyMV0sMjM6WzIsMjFdLDI1OlsyLDIxXX0sezE4OlsxLDY2XX0sezE4OlsyLDQyXX0sezE4OlsxLDY3XX0sezg6MTcsOTo1LDExOjYsMTI6NywxMzo4LDE0OlsxLDldLDE1OlsxLDEwXSwxNjpbMSwxMl0sMTk6WzEsMTFdLDIwOlsyLDRdLDIyOlsxLDEzXSwyMzpbMSwxNF0sMjU6WzEsMTVdfSx7MTg6WzIsMjRdLDI0OlsyLDI0XSwzNjpbMiwyNF19LHsxODpbMiw0NF0sMjQ6WzIsNDRdLDMyOlsyLDQ0XSwzMzpbMiw0NF0sMzQ6WzIsNDRdLDM1OlsyLDQ0XSwzNjpbMiw0NF0sNDA6WzIsNDRdLDQyOlsyLDQ0XX0sezE4OlsyLDQ2XSwyNDpbMiw0Nl0sMzY6WzIsNDZdfSx7MTg6WzIsMjZdLDI0OlsyLDI2XSwzMjpbMiwyNl0sMzM6WzIsMjZdLDM0OlsyLDI2XSwzNTpbMiwyNl0sMzY6WzIsMjZdLDQwOlsyLDI2XSw0MjpbMiwyNl19LHsxODpbMiwyN10sMjQ6WzIsMjddLDMyOlsyLDI3XSwzMzpbMiwyN10sMzQ6WzIsMjddLDM1OlsyLDI3XSwzNjpbMiwyN10sNDA6WzIsMjddLDQyOlsyLDI3XX0sezE4OlsyLDI4XSwyNDpbMiwyOF0sMzI6WzIsMjhdLDMzOlsyLDI4XSwzNDpbMiwyOF0sMzU6WzIsMjhdLDM2OlsyLDI4XSw0MDpbMiwyOF0sNDI6WzIsMjhdfSx7MTg6WzIsMjldLDI0OlsyLDI5XSwzMjpbMiwyOV0sMzM6WzIsMjldLDM0OlsyLDI5XSwzNTpbMiwyOV0sMzY6WzIsMjldLDQwOlsyLDI5XSw0MjpbMiwyOV19LHsxODpbMiwzMF0sMjQ6WzIsMzBdLDMyOlsyLDMwXSwzMzpbMiwzMF0sMzQ6WzIsMzBdLDM1OlsyLDMwXSwzNjpbMiwzMF0sNDA6WzIsMzBdLDQyOlsyLDMwXX0sezE3OjY4LDIxOjI0LDMwOjI1LDQwOlsxLDI4XSw0MjpbMSwyN10sNDM6MjZ9LHsxODpbMiwzMl0sMjQ6WzIsMzJdLDM2OlsyLDMyXSwzOTo2OSw0MDpbMSw3MF19LHsxODpbMiw0N10sMjQ6WzIsNDddLDM2OlsyLDQ3XSw0MDpbMiw0N119LHsxODpbMiw0MF0sMjQ6WzIsNDBdLDMyOlsyLDQwXSwzMzpbMiw0MF0sMzQ6WzIsNDBdLDM1OlsyLDQwXSwzNjpbMiw0MF0sNDA6WzIsNDBdLDQxOlsxLDcxXSw0MjpbMiw0MF0sNDQ6WzIsNDBdfSx7MTg6WzIsMzldLDI0OlsyLDM5XSwzMjpbMiwzOV0sMzM6WzIsMzldLDM0OlsyLDM5XSwzNTpbMiwzOV0sMzY6WzIsMzldLDQwOlsyLDM5XSw0MjpbMiwzOV0sNDQ6WzIsMzldfSx7NTpbMiwyMl0sMTQ6WzIsMjJdLDE1OlsyLDIyXSwxNjpbMiwyMl0sMTk6WzIsMjJdLDIwOlsyLDIyXSwyMjpbMiwyMl0sMjM6WzIsMjJdLDI1OlsyLDIyXX0sezU6WzIsMTldLDE0OlsyLDE5XSwxNTpbMiwxOV0sMTY6WzIsMTldLDE5OlsyLDE5XSwyMDpbMiwxOV0sMjI6WzIsMTldLDIzOlsyLDE5XSwyNTpbMiwxOV19LHszNjpbMSw3Ml19LHsxODpbMiw0OF0sMjQ6WzIsNDhdLDM2OlsyLDQ4XSw0MDpbMiw0OF19LHs0MTpbMSw3MV19LHsyMTo1NiwzMDo2MCwzMTo3MywzMjpbMSw1N10sMzM6WzEsNThdLDM0OlsxLDU5XSwzNTpbMSw2MV0sNDA6WzEsMjhdLDQyOlsxLDI3XSw0MzoyNn0sezE4OlsyLDMxXSwyNDpbMiwzMV0sMzI6WzIsMzFdLDMzOlsyLDMxXSwzNDpbMiwzMV0sMzU6WzIsMzFdLDM2OlsyLDMxXSw0MDpbMiwzMV0sNDI6WzIsMzFdfSx7MTg6WzIsMzNdLDI0OlsyLDMzXSwzNjpbMiwzM10sNDA6WzIsMzNdfV0sXG5kZWZhdWx0QWN0aW9uczogezM6WzIsMl0sMTY6WzIsMV0sNTA6WzIsNDJdfSxcbnBhcnNlRXJyb3I6IGZ1bmN0aW9uIHBhcnNlRXJyb3Ioc3RyLCBoYXNoKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKHN0cik7XG59LFxucGFyc2U6IGZ1bmN0aW9uIHBhcnNlKGlucHV0KSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzLCBzdGFjayA9IFswXSwgdnN0YWNrID0gW251bGxdLCBsc3RhY2sgPSBbXSwgdGFibGUgPSB0aGlzLnRhYmxlLCB5eXRleHQgPSBcIlwiLCB5eWxpbmVubyA9IDAsIHl5bGVuZyA9IDAsIHJlY292ZXJpbmcgPSAwLCBURVJST1IgPSAyLCBFT0YgPSAxO1xuICAgIHRoaXMubGV4ZXIuc2V0SW5wdXQoaW5wdXQpO1xuICAgIHRoaXMubGV4ZXIueXkgPSB0aGlzLnl5O1xuICAgIHRoaXMueXkubGV4ZXIgPSB0aGlzLmxleGVyO1xuICAgIHRoaXMueXkucGFyc2VyID0gdGhpcztcbiAgICBpZiAodHlwZW9mIHRoaXMubGV4ZXIueXlsbG9jID09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgIHRoaXMubGV4ZXIueXlsbG9jID0ge307XG4gICAgdmFyIHl5bG9jID0gdGhpcy5sZXhlci55eWxsb2M7XG4gICAgbHN0YWNrLnB1c2goeXlsb2MpO1xuICAgIHZhciByYW5nZXMgPSB0aGlzLmxleGVyLm9wdGlvbnMgJiYgdGhpcy5sZXhlci5vcHRpb25zLnJhbmdlcztcbiAgICBpZiAodHlwZW9mIHRoaXMueXkucGFyc2VFcnJvciA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICB0aGlzLnBhcnNlRXJyb3IgPSB0aGlzLnl5LnBhcnNlRXJyb3I7XG4gICAgZnVuY3Rpb24gcG9wU3RhY2sobikge1xuICAgICAgICBzdGFjay5sZW5ndGggPSBzdGFjay5sZW5ndGggLSAyICogbjtcbiAgICAgICAgdnN0YWNrLmxlbmd0aCA9IHZzdGFjay5sZW5ndGggLSBuO1xuICAgICAgICBsc3RhY2subGVuZ3RoID0gbHN0YWNrLmxlbmd0aCAtIG47XG4gICAgfVxuICAgIGZ1bmN0aW9uIGxleCgpIHtcbiAgICAgICAgdmFyIHRva2VuO1xuICAgICAgICB0b2tlbiA9IHNlbGYubGV4ZXIubGV4KCkgfHwgMTtcbiAgICAgICAgaWYgKHR5cGVvZiB0b2tlbiAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgdG9rZW4gPSBzZWxmLnN5bWJvbHNfW3Rva2VuXSB8fCB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdG9rZW47XG4gICAgfVxuICAgIHZhciBzeW1ib2wsIHByZUVycm9yU3ltYm9sLCBzdGF0ZSwgYWN0aW9uLCBhLCByLCB5eXZhbCA9IHt9LCBwLCBsZW4sIG5ld1N0YXRlLCBleHBlY3RlZDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgICBzdGF0ZSA9IHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xuICAgICAgICBpZiAodGhpcy5kZWZhdWx0QWN0aW9uc1tzdGF0ZV0pIHtcbiAgICAgICAgICAgIGFjdGlvbiA9IHRoaXMuZGVmYXVsdEFjdGlvbnNbc3RhdGVdO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHN5bWJvbCA9PT0gbnVsbCB8fCB0eXBlb2Ygc3ltYm9sID09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgICAgICAgICBzeW1ib2wgPSBsZXgoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGFjdGlvbiA9IHRhYmxlW3N0YXRlXSAmJiB0YWJsZVtzdGF0ZV1bc3ltYm9sXTtcbiAgICAgICAgfVxuICAgICAgICBpZiAodHlwZW9mIGFjdGlvbiA9PT0gXCJ1bmRlZmluZWRcIiB8fCAhYWN0aW9uLmxlbmd0aCB8fCAhYWN0aW9uWzBdKSB7XG4gICAgICAgICAgICB2YXIgZXJyU3RyID0gXCJcIjtcbiAgICAgICAgICAgIGlmICghcmVjb3ZlcmluZykge1xuICAgICAgICAgICAgICAgIGV4cGVjdGVkID0gW107XG4gICAgICAgICAgICAgICAgZm9yIChwIGluIHRhYmxlW3N0YXRlXSlcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMudGVybWluYWxzX1twXSAmJiBwID4gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgZXhwZWN0ZWQucHVzaChcIidcIiArIHRoaXMudGVybWluYWxzX1twXSArIFwiJ1wiKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0aGlzLmxleGVyLnNob3dQb3NpdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBlcnJTdHIgPSBcIlBhcnNlIGVycm9yIG9uIGxpbmUgXCIgKyAoeXlsaW5lbm8gKyAxKSArIFwiOlxcblwiICsgdGhpcy5sZXhlci5zaG93UG9zaXRpb24oKSArIFwiXFxuRXhwZWN0aW5nIFwiICsgZXhwZWN0ZWQuam9pbihcIiwgXCIpICsgXCIsIGdvdCAnXCIgKyAodGhpcy50ZXJtaW5hbHNfW3N5bWJvbF0gfHwgc3ltYm9sKSArIFwiJ1wiO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGVyclN0ciA9IFwiUGFyc2UgZXJyb3Igb24gbGluZSBcIiArICh5eWxpbmVubyArIDEpICsgXCI6IFVuZXhwZWN0ZWQgXCIgKyAoc3ltYm9sID09IDE/XCJlbmQgb2YgaW5wdXRcIjpcIidcIiArICh0aGlzLnRlcm1pbmFsc19bc3ltYm9sXSB8fCBzeW1ib2wpICsgXCInXCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlRXJyb3IoZXJyU3RyLCB7dGV4dDogdGhpcy5sZXhlci5tYXRjaCwgdG9rZW46IHRoaXMudGVybWluYWxzX1tzeW1ib2xdIHx8IHN5bWJvbCwgbGluZTogdGhpcy5sZXhlci55eWxpbmVubywgbG9jOiB5eWxvYywgZXhwZWN0ZWQ6IGV4cGVjdGVkfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFjdGlvblswXSBpbnN0YW5jZW9mIEFycmF5ICYmIGFjdGlvbi5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJQYXJzZSBFcnJvcjogbXVsdGlwbGUgYWN0aW9ucyBwb3NzaWJsZSBhdCBzdGF0ZTogXCIgKyBzdGF0ZSArIFwiLCB0b2tlbjogXCIgKyBzeW1ib2wpO1xuICAgICAgICB9XG4gICAgICAgIHN3aXRjaCAoYWN0aW9uWzBdKSB7XG4gICAgICAgIGNhc2UgMTpcbiAgICAgICAgICAgIHN0YWNrLnB1c2goc3ltYm9sKTtcbiAgICAgICAgICAgIHZzdGFjay5wdXNoKHRoaXMubGV4ZXIueXl0ZXh0KTtcbiAgICAgICAgICAgIGxzdGFjay5wdXNoKHRoaXMubGV4ZXIueXlsbG9jKTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2goYWN0aW9uWzFdKTtcbiAgICAgICAgICAgIHN5bWJvbCA9IG51bGw7XG4gICAgICAgICAgICBpZiAoIXByZUVycm9yU3ltYm9sKSB7XG4gICAgICAgICAgICAgICAgeXlsZW5nID0gdGhpcy5sZXhlci55eWxlbmc7XG4gICAgICAgICAgICAgICAgeXl0ZXh0ID0gdGhpcy5sZXhlci55eXRleHQ7XG4gICAgICAgICAgICAgICAgeXlsaW5lbm8gPSB0aGlzLmxleGVyLnl5bGluZW5vO1xuICAgICAgICAgICAgICAgIHl5bG9jID0gdGhpcy5sZXhlci55eWxsb2M7XG4gICAgICAgICAgICAgICAgaWYgKHJlY292ZXJpbmcgPiAwKVxuICAgICAgICAgICAgICAgICAgICByZWNvdmVyaW5nLS07XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN5bWJvbCA9IHByZUVycm9yU3ltYm9sO1xuICAgICAgICAgICAgICAgIHByZUVycm9yU3ltYm9sID0gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgICAgICBsZW4gPSB0aGlzLnByb2R1Y3Rpb25zX1thY3Rpb25bMV1dWzFdO1xuICAgICAgICAgICAgeXl2YWwuJCA9IHZzdGFja1t2c3RhY2subGVuZ3RoIC0gbGVuXTtcbiAgICAgICAgICAgIHl5dmFsLl8kID0ge2ZpcnN0X2xpbmU6IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0uZmlyc3RfbGluZSwgbGFzdF9saW5lOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIDFdLmxhc3RfbGluZSwgZmlyc3RfY29sdW1uOiBsc3RhY2tbbHN0YWNrLmxlbmd0aCAtIChsZW4gfHwgMSldLmZpcnN0X2NvbHVtbiwgbGFzdF9jb2x1bW46IGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ubGFzdF9jb2x1bW59O1xuICAgICAgICAgICAgaWYgKHJhbmdlcykge1xuICAgICAgICAgICAgICAgIHl5dmFsLl8kLnJhbmdlID0gW2xzdGFja1tsc3RhY2subGVuZ3RoIC0gKGxlbiB8fCAxKV0ucmFuZ2VbMF0sIGxzdGFja1tsc3RhY2subGVuZ3RoIC0gMV0ucmFuZ2VbMV1dO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgciA9IHRoaXMucGVyZm9ybUFjdGlvbi5jYWxsKHl5dmFsLCB5eXRleHQsIHl5bGVuZywgeXlsaW5lbm8sIHRoaXMueXksIGFjdGlvblsxXSwgdnN0YWNrLCBsc3RhY2spO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHI7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAobGVuKSB7XG4gICAgICAgICAgICAgICAgc3RhY2sgPSBzdGFjay5zbGljZSgwLCAtMSAqIGxlbiAqIDIpO1xuICAgICAgICAgICAgICAgIHZzdGFjayA9IHZzdGFjay5zbGljZSgwLCAtMSAqIGxlbik7XG4gICAgICAgICAgICAgICAgbHN0YWNrID0gbHN0YWNrLnNsaWNlKDAsIC0xICogbGVuKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHN0YWNrLnB1c2godGhpcy5wcm9kdWN0aW9uc19bYWN0aW9uWzFdXVswXSk7XG4gICAgICAgICAgICB2c3RhY2sucHVzaCh5eXZhbC4kKTtcbiAgICAgICAgICAgIGxzdGFjay5wdXNoKHl5dmFsLl8kKTtcbiAgICAgICAgICAgIG5ld1N0YXRlID0gdGFibGVbc3RhY2tbc3RhY2subGVuZ3RoIC0gMl1dW3N0YWNrW3N0YWNrLmxlbmd0aCAtIDFdXTtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gobmV3U3RhdGUpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0cnVlO1xufVxufTtcblxuXG5mdW5jdGlvbiBzdHJpcEZsYWdzKG9wZW4sIGNsb3NlKSB7XG4gIHJldHVybiB7XG4gICAgbGVmdDogb3Blbi5jaGFyQXQoMikgPT09ICd+JyxcbiAgICByaWdodDogY2xvc2UuY2hhckF0KDApID09PSAnficgfHwgY2xvc2UuY2hhckF0KDEpID09PSAnfidcbiAgfTtcbn1cblxuLyogSmlzb24gZ2VuZXJhdGVkIGxleGVyICovXG52YXIgbGV4ZXIgPSAoZnVuY3Rpb24oKXtcbnZhciBsZXhlciA9ICh7RU9GOjEsXG5wYXJzZUVycm9yOmZ1bmN0aW9uIHBhcnNlRXJyb3Ioc3RyLCBoYXNoKSB7XG4gICAgICAgIGlmICh0aGlzLnl5LnBhcnNlcikge1xuICAgICAgICAgICAgdGhpcy55eS5wYXJzZXIucGFyc2VFcnJvcihzdHIsIGhhc2gpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKHN0cik7XG4gICAgICAgIH1cbiAgICB9LFxuc2V0SW5wdXQ6ZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgICAgIHRoaXMuX2lucHV0ID0gaW5wdXQ7XG4gICAgICAgIHRoaXMuX21vcmUgPSB0aGlzLl9sZXNzID0gdGhpcy5kb25lID0gZmFsc2U7XG4gICAgICAgIHRoaXMueXlsaW5lbm8gPSB0aGlzLnl5bGVuZyA9IDA7XG4gICAgICAgIHRoaXMueXl0ZXh0ID0gdGhpcy5tYXRjaGVkID0gdGhpcy5tYXRjaCA9ICcnO1xuICAgICAgICB0aGlzLmNvbmRpdGlvblN0YWNrID0gWydJTklUSUFMJ107XG4gICAgICAgIHRoaXMueXlsbG9jID0ge2ZpcnN0X2xpbmU6MSxmaXJzdF9jb2x1bW46MCxsYXN0X2xpbmU6MSxsYXN0X2NvbHVtbjowfTtcbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHRoaXMueXlsbG9jLnJhbmdlID0gWzAsMF07XG4gICAgICAgIHRoaXMub2Zmc2V0ID0gMDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcbmlucHV0OmZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGNoID0gdGhpcy5faW5wdXRbMF07XG4gICAgICAgIHRoaXMueXl0ZXh0ICs9IGNoO1xuICAgICAgICB0aGlzLnl5bGVuZysrO1xuICAgICAgICB0aGlzLm9mZnNldCsrO1xuICAgICAgICB0aGlzLm1hdGNoICs9IGNoO1xuICAgICAgICB0aGlzLm1hdGNoZWQgKz0gY2g7XG4gICAgICAgIHZhciBsaW5lcyA9IGNoLm1hdGNoKC8oPzpcXHJcXG4/fFxcbikuKi9nKTtcbiAgICAgICAgaWYgKGxpbmVzKSB7XG4gICAgICAgICAgICB0aGlzLnl5bGluZW5vKys7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYy5sYXN0X2xpbmUrKztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMueXlsbG9jLmxhc3RfY29sdW1uKys7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHRoaXMueXlsbG9jLnJhbmdlWzFdKys7XG5cbiAgICAgICAgdGhpcy5faW5wdXQgPSB0aGlzLl9pbnB1dC5zbGljZSgxKTtcbiAgICAgICAgcmV0dXJuIGNoO1xuICAgIH0sXG51bnB1dDpmdW5jdGlvbiAoY2gpIHtcbiAgICAgICAgdmFyIGxlbiA9IGNoLmxlbmd0aDtcbiAgICAgICAgdmFyIGxpbmVzID0gY2guc3BsaXQoLyg/Olxcclxcbj98XFxuKS9nKTtcblxuICAgICAgICB0aGlzLl9pbnB1dCA9IGNoICsgdGhpcy5faW5wdXQ7XG4gICAgICAgIHRoaXMueXl0ZXh0ID0gdGhpcy55eXRleHQuc3Vic3RyKDAsIHRoaXMueXl0ZXh0Lmxlbmd0aC1sZW4tMSk7XG4gICAgICAgIC8vdGhpcy55eWxlbmcgLT0gbGVuO1xuICAgICAgICB0aGlzLm9mZnNldCAtPSBsZW47XG4gICAgICAgIHZhciBvbGRMaW5lcyA9IHRoaXMubWF0Y2guc3BsaXQoLyg/Olxcclxcbj98XFxuKS9nKTtcbiAgICAgICAgdGhpcy5tYXRjaCA9IHRoaXMubWF0Y2guc3Vic3RyKDAsIHRoaXMubWF0Y2gubGVuZ3RoLTEpO1xuICAgICAgICB0aGlzLm1hdGNoZWQgPSB0aGlzLm1hdGNoZWQuc3Vic3RyKDAsIHRoaXMubWF0Y2hlZC5sZW5ndGgtMSk7XG5cbiAgICAgICAgaWYgKGxpbmVzLmxlbmd0aC0xKSB0aGlzLnl5bGluZW5vIC09IGxpbmVzLmxlbmd0aC0xO1xuICAgICAgICB2YXIgciA9IHRoaXMueXlsbG9jLnJhbmdlO1xuXG4gICAgICAgIHRoaXMueXlsbG9jID0ge2ZpcnN0X2xpbmU6IHRoaXMueXlsbG9jLmZpcnN0X2xpbmUsXG4gICAgICAgICAgbGFzdF9saW5lOiB0aGlzLnl5bGluZW5vKzEsXG4gICAgICAgICAgZmlyc3RfY29sdW1uOiB0aGlzLnl5bGxvYy5maXJzdF9jb2x1bW4sXG4gICAgICAgICAgbGFzdF9jb2x1bW46IGxpbmVzID9cbiAgICAgICAgICAgICAgKGxpbmVzLmxlbmd0aCA9PT0gb2xkTGluZXMubGVuZ3RoID8gdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uIDogMCkgKyBvbGRMaW5lc1tvbGRMaW5lcy5sZW5ndGggLSBsaW5lcy5sZW5ndGhdLmxlbmd0aCAtIGxpbmVzWzBdLmxlbmd0aDpcbiAgICAgICAgICAgICAgdGhpcy55eWxsb2MuZmlyc3RfY29sdW1uIC0gbGVuXG4gICAgICAgICAgfTtcblxuICAgICAgICBpZiAodGhpcy5vcHRpb25zLnJhbmdlcykge1xuICAgICAgICAgICAgdGhpcy55eWxsb2MucmFuZ2UgPSBbclswXSwgclswXSArIHRoaXMueXlsZW5nIC0gbGVuXTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxubW9yZTpmdW5jdGlvbiAoKSB7XG4gICAgICAgIHRoaXMuX21vcmUgPSB0cnVlO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9LFxubGVzczpmdW5jdGlvbiAobikge1xuICAgICAgICB0aGlzLnVucHV0KHRoaXMubWF0Y2guc2xpY2UobikpO1xuICAgIH0sXG5wYXN0SW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcGFzdCA9IHRoaXMubWF0Y2hlZC5zdWJzdHIoMCwgdGhpcy5tYXRjaGVkLmxlbmd0aCAtIHRoaXMubWF0Y2gubGVuZ3RoKTtcbiAgICAgICAgcmV0dXJuIChwYXN0Lmxlbmd0aCA+IDIwID8gJy4uLic6JycpICsgcGFzdC5zdWJzdHIoLTIwKS5yZXBsYWNlKC9cXG4vZywgXCJcIik7XG4gICAgfSxcbnVwY29taW5nSW5wdXQ6ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgbmV4dCA9IHRoaXMubWF0Y2g7XG4gICAgICAgIGlmIChuZXh0Lmxlbmd0aCA8IDIwKSB7XG4gICAgICAgICAgICBuZXh0ICs9IHRoaXMuX2lucHV0LnN1YnN0cigwLCAyMC1uZXh0Lmxlbmd0aCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIChuZXh0LnN1YnN0cigwLDIwKSsobmV4dC5sZW5ndGggPiAyMCA/ICcuLi4nOicnKSkucmVwbGFjZSgvXFxuL2csIFwiXCIpO1xuICAgIH0sXG5zaG93UG9zaXRpb246ZnVuY3Rpb24gKCkge1xuICAgICAgICB2YXIgcHJlID0gdGhpcy5wYXN0SW5wdXQoKTtcbiAgICAgICAgdmFyIGMgPSBuZXcgQXJyYXkocHJlLmxlbmd0aCArIDEpLmpvaW4oXCItXCIpO1xuICAgICAgICByZXR1cm4gcHJlICsgdGhpcy51cGNvbWluZ0lucHV0KCkgKyBcIlxcblwiICsgYytcIl5cIjtcbiAgICB9LFxubmV4dDpmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICh0aGlzLmRvbmUpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLkVPRjtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIXRoaXMuX2lucHV0KSB0aGlzLmRvbmUgPSB0cnVlO1xuXG4gICAgICAgIHZhciB0b2tlbixcbiAgICAgICAgICAgIG1hdGNoLFxuICAgICAgICAgICAgdGVtcE1hdGNoLFxuICAgICAgICAgICAgaW5kZXgsXG4gICAgICAgICAgICBjb2wsXG4gICAgICAgICAgICBsaW5lcztcbiAgICAgICAgaWYgKCF0aGlzLl9tb3JlKSB7XG4gICAgICAgICAgICB0aGlzLnl5dGV4dCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5tYXRjaCA9ICcnO1xuICAgICAgICB9XG4gICAgICAgIHZhciBydWxlcyA9IHRoaXMuX2N1cnJlbnRSdWxlcygpO1xuICAgICAgICBmb3IgKHZhciBpPTA7aSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB0ZW1wTWF0Y2ggPSB0aGlzLl9pbnB1dC5tYXRjaCh0aGlzLnJ1bGVzW3J1bGVzW2ldXSk7XG4gICAgICAgICAgICBpZiAodGVtcE1hdGNoICYmICghbWF0Y2ggfHwgdGVtcE1hdGNoWzBdLmxlbmd0aCA+IG1hdGNoWzBdLmxlbmd0aCkpIHtcbiAgICAgICAgICAgICAgICBtYXRjaCA9IHRlbXBNYXRjaDtcbiAgICAgICAgICAgICAgICBpbmRleCA9IGk7XG4gICAgICAgICAgICAgICAgaWYgKCF0aGlzLm9wdGlvbnMuZmxleCkgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgICAgICBsaW5lcyA9IG1hdGNoWzBdLm1hdGNoKC8oPzpcXHJcXG4/fFxcbikuKi9nKTtcbiAgICAgICAgICAgIGlmIChsaW5lcykgdGhpcy55eWxpbmVubyArPSBsaW5lcy5sZW5ndGg7XG4gICAgICAgICAgICB0aGlzLnl5bGxvYyA9IHtmaXJzdF9saW5lOiB0aGlzLnl5bGxvYy5sYXN0X2xpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0X2xpbmU6IHRoaXMueXlsaW5lbm8rMSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGZpcnN0X2NvbHVtbjogdGhpcy55eWxsb2MubGFzdF9jb2x1bW4sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICBsYXN0X2NvbHVtbjogbGluZXMgPyBsaW5lc1tsaW5lcy5sZW5ndGgtMV0ubGVuZ3RoLWxpbmVzW2xpbmVzLmxlbmd0aC0xXS5tYXRjaCgvXFxyP1xcbj8vKVswXS5sZW5ndGggOiB0aGlzLnl5bGxvYy5sYXN0X2NvbHVtbiArIG1hdGNoWzBdLmxlbmd0aH07XG4gICAgICAgICAgICB0aGlzLnl5dGV4dCArPSBtYXRjaFswXTtcbiAgICAgICAgICAgIHRoaXMubWF0Y2ggKz0gbWF0Y2hbMF07XG4gICAgICAgICAgICB0aGlzLm1hdGNoZXMgPSBtYXRjaDtcbiAgICAgICAgICAgIHRoaXMueXlsZW5nID0gdGhpcy55eXRleHQubGVuZ3RoO1xuICAgICAgICAgICAgaWYgKHRoaXMub3B0aW9ucy5yYW5nZXMpIHtcbiAgICAgICAgICAgICAgICB0aGlzLnl5bGxvYy5yYW5nZSA9IFt0aGlzLm9mZnNldCwgdGhpcy5vZmZzZXQgKz0gdGhpcy55eWxlbmddO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5fbW9yZSA9IGZhbHNlO1xuICAgICAgICAgICAgdGhpcy5faW5wdXQgPSB0aGlzLl9pbnB1dC5zbGljZShtYXRjaFswXS5sZW5ndGgpO1xuICAgICAgICAgICAgdGhpcy5tYXRjaGVkICs9IG1hdGNoWzBdO1xuICAgICAgICAgICAgdG9rZW4gPSB0aGlzLnBlcmZvcm1BY3Rpb24uY2FsbCh0aGlzLCB0aGlzLnl5LCB0aGlzLCBydWxlc1tpbmRleF0sdGhpcy5jb25kaXRpb25TdGFja1t0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aC0xXSk7XG4gICAgICAgICAgICBpZiAodGhpcy5kb25lICYmIHRoaXMuX2lucHV0KSB0aGlzLmRvbmUgPSBmYWxzZTtcbiAgICAgICAgICAgIGlmICh0b2tlbikgcmV0dXJuIHRva2VuO1xuICAgICAgICAgICAgZWxzZSByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHRoaXMuX2lucHV0ID09PSBcIlwiKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5FT0Y7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wYXJzZUVycm9yKCdMZXhpY2FsIGVycm9yIG9uIGxpbmUgJysodGhpcy55eWxpbmVubysxKSsnLiBVbnJlY29nbml6ZWQgdGV4dC5cXG4nK3RoaXMuc2hvd1Bvc2l0aW9uKCksXG4gICAgICAgICAgICAgICAgICAgIHt0ZXh0OiBcIlwiLCB0b2tlbjogbnVsbCwgbGluZTogdGhpcy55eWxpbmVub30pO1xuICAgICAgICB9XG4gICAgfSxcbmxleDpmdW5jdGlvbiBsZXgoKSB7XG4gICAgICAgIHZhciByID0gdGhpcy5uZXh0KCk7XG4gICAgICAgIGlmICh0eXBlb2YgciAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgICAgICAgIHJldHVybiByO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubGV4KCk7XG4gICAgICAgIH1cbiAgICB9LFxuYmVnaW46ZnVuY3Rpb24gYmVnaW4oY29uZGl0aW9uKSB7XG4gICAgICAgIHRoaXMuY29uZGl0aW9uU3RhY2sucHVzaChjb25kaXRpb24pO1xuICAgIH0sXG5wb3BTdGF0ZTpmdW5jdGlvbiBwb3BTdGF0ZSgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uU3RhY2sucG9wKCk7XG4gICAgfSxcbl9jdXJyZW50UnVsZXM6ZnVuY3Rpb24gX2N1cnJlbnRSdWxlcygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuY29uZGl0aW9uc1t0aGlzLmNvbmRpdGlvblN0YWNrW3RoaXMuY29uZGl0aW9uU3RhY2subGVuZ3RoLTFdXS5ydWxlcztcbiAgICB9LFxudG9wU3RhdGU6ZnVuY3Rpb24gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy5jb25kaXRpb25TdGFja1t0aGlzLmNvbmRpdGlvblN0YWNrLmxlbmd0aC0yXTtcbiAgICB9LFxucHVzaFN0YXRlOmZ1bmN0aW9uIGJlZ2luKGNvbmRpdGlvbikge1xuICAgICAgICB0aGlzLmJlZ2luKGNvbmRpdGlvbik7XG4gICAgfX0pO1xubGV4ZXIub3B0aW9ucyA9IHt9O1xubGV4ZXIucGVyZm9ybUFjdGlvbiA9IGZ1bmN0aW9uIGFub255bW91cyh5eSx5eV8sJGF2b2lkaW5nX25hbWVfY29sbGlzaW9ucyxZWV9TVEFSVCkge1xuXG5cbmZ1bmN0aW9uIHN0cmlwKHN0YXJ0LCBlbmQpIHtcbiAgcmV0dXJuIHl5Xy55eXRleHQgPSB5eV8ueXl0ZXh0LnN1YnN0cihzdGFydCwgeXlfLnl5bGVuZy1lbmQpO1xufVxuXG5cbnZhciBZWVNUQVRFPVlZX1NUQVJUXG5zd2l0Y2goJGF2b2lkaW5nX25hbWVfY29sbGlzaW9ucykge1xuY2FzZSAwOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZih5eV8ueXl0ZXh0LnNsaWNlKC0yKSA9PT0gXCJcXFxcXFxcXFwiKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3RyaXAoMCwxKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLmJlZ2luKFwibXVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSBpZih5eV8ueXl0ZXh0LnNsaWNlKC0xKSA9PT0gXCJcXFxcXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHJpcCgwLDEpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuYmVnaW4oXCJlbXVcIik7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5iZWdpbihcIm11XCIpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmKHl5Xy55eXRleHQpIHJldHVybiAxNDtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFxuYnJlYWs7XG5jYXNlIDE6cmV0dXJuIDE0O1xuYnJlYWs7XG5jYXNlIDI6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucG9wU3RhdGUoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDE0O1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXG5icmVhaztcbmNhc2UgMzpzdHJpcCgwLDQpOyB0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAxNTtcbmJyZWFrO1xuY2FzZSA0OnJldHVybiAzNTtcbmJyZWFrO1xuY2FzZSA1OnJldHVybiAzNjtcbmJyZWFrO1xuY2FzZSA2OnJldHVybiAyNTtcbmJyZWFrO1xuY2FzZSA3OnJldHVybiAxNjtcbmJyZWFrO1xuY2FzZSA4OnJldHVybiAyMDtcbmJyZWFrO1xuY2FzZSA5OnJldHVybiAxOTtcbmJyZWFrO1xuY2FzZSAxMDpyZXR1cm4gMTk7XG5icmVhaztcbmNhc2UgMTE6cmV0dXJuIDIzO1xuYnJlYWs7XG5jYXNlIDEyOnJldHVybiAyMjtcbmJyZWFrO1xuY2FzZSAxMzp0aGlzLnBvcFN0YXRlKCk7IHRoaXMuYmVnaW4oJ2NvbScpO1xuYnJlYWs7XG5jYXNlIDE0OnN0cmlwKDMsNSk7IHRoaXMucG9wU3RhdGUoKTsgcmV0dXJuIDE1O1xuYnJlYWs7XG5jYXNlIDE1OnJldHVybiAyMjtcbmJyZWFrO1xuY2FzZSAxNjpyZXR1cm4gNDE7XG5icmVhaztcbmNhc2UgMTc6cmV0dXJuIDQwO1xuYnJlYWs7XG5jYXNlIDE4OnJldHVybiA0MDtcbmJyZWFrO1xuY2FzZSAxOTpyZXR1cm4gNDQ7XG5icmVhaztcbmNhc2UgMjA6Ly8gaWdub3JlIHdoaXRlc3BhY2VcbmJyZWFrO1xuY2FzZSAyMTp0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAyNDtcbmJyZWFrO1xuY2FzZSAyMjp0aGlzLnBvcFN0YXRlKCk7IHJldHVybiAxODtcbmJyZWFrO1xuY2FzZSAyMzp5eV8ueXl0ZXh0ID0gc3RyaXAoMSwyKS5yZXBsYWNlKC9cXFxcXCIvZywnXCInKTsgcmV0dXJuIDMyO1xuYnJlYWs7XG5jYXNlIDI0Onl5Xy55eXRleHQgPSBzdHJpcCgxLDIpLnJlcGxhY2UoL1xcXFwnL2csXCInXCIpOyByZXR1cm4gMzI7XG5icmVhaztcbmNhc2UgMjU6cmV0dXJuIDQyO1xuYnJlYWs7XG5jYXNlIDI2OnJldHVybiAzNDtcbmJyZWFrO1xuY2FzZSAyNzpyZXR1cm4gMzQ7XG5icmVhaztcbmNhc2UgMjg6cmV0dXJuIDMzO1xuYnJlYWs7XG5jYXNlIDI5OnJldHVybiA0MDtcbmJyZWFrO1xuY2FzZSAzMDp5eV8ueXl0ZXh0ID0gc3RyaXAoMSwyKTsgcmV0dXJuIDQwO1xuYnJlYWs7XG5jYXNlIDMxOnJldHVybiAnSU5WQUxJRCc7XG5icmVhaztcbmNhc2UgMzI6cmV0dXJuIDU7XG5icmVhaztcbn1cbn07XG5sZXhlci5ydWxlcyA9IFsvXig/OlteXFx4MDBdKj8oPz0oXFx7XFx7KSkpLywvXig/OlteXFx4MDBdKykvLC9eKD86W15cXHgwMF17Mix9Pyg/PShcXHtcXHt8XFxcXFxce1xce3xcXFxcXFxcXFxce1xce3wkKSkpLywvXig/OltcXHNcXFNdKj8tLVxcfVxcfSkvLC9eKD86XFwoKS8sL14oPzpcXCkpLywvXig/Olxce1xceyh+KT8+KS8sL14oPzpcXHtcXHsofik/IykvLC9eKD86XFx7XFx7KH4pP1xcLykvLC9eKD86XFx7XFx7KH4pP1xcXikvLC9eKD86XFx7XFx7KH4pP1xccyplbHNlXFxiKS8sL14oPzpcXHtcXHsofik/XFx7KS8sL14oPzpcXHtcXHsofik/JikvLC9eKD86XFx7XFx7IS0tKS8sL14oPzpcXHtcXHshW1xcc1xcU10qP1xcfVxcfSkvLC9eKD86XFx7XFx7KH4pPykvLC9eKD86PSkvLC9eKD86XFwuXFwuKS8sL14oPzpcXC4oPz0oWz1+fVxcc1xcLy4pXSkpKS8sL14oPzpbXFwvLl0pLywvXig/OlxccyspLywvXig/OlxcfSh+KT9cXH1cXH0pLywvXig/Oih+KT9cXH1cXH0pLywvXig/OlwiKFxcXFxbXCJdfFteXCJdKSpcIikvLC9eKD86JyhcXFxcWyddfFteJ10pKicpLywvXig/OkApLywvXig/OnRydWUoPz0oW359XFxzKV0pKSkvLC9eKD86ZmFsc2UoPz0oW359XFxzKV0pKSkvLC9eKD86LT9bMC05XSsoPz0oW359XFxzKV0pKSkvLC9eKD86KFteXFxzIVwiIyUtLFxcLlxcLzstPkBcXFstXFxeYFxcey1+XSsoPz0oWz1+fVxcc1xcLy4pXSkpKSkvLC9eKD86XFxbW15cXF1dKlxcXSkvLC9eKD86LikvLC9eKD86JCkvXTtcbmxleGVyLmNvbmRpdGlvbnMgPSB7XCJtdVwiOntcInJ1bGVzXCI6WzQsNSw2LDcsOCw5LDEwLDExLDEyLDEzLDE0LDE1LDE2LDE3LDE4LDE5LDIwLDIxLDIyLDIzLDI0LDI1LDI2LDI3LDI4LDI5LDMwLDMxLDMyXSxcImluY2x1c2l2ZVwiOmZhbHNlfSxcImVtdVwiOntcInJ1bGVzXCI6WzJdLFwiaW5jbHVzaXZlXCI6ZmFsc2V9LFwiY29tXCI6e1wicnVsZXNcIjpbM10sXCJpbmNsdXNpdmVcIjpmYWxzZX0sXCJJTklUSUFMXCI6e1wicnVsZXNcIjpbMCwxLDMyXSxcImluY2x1c2l2ZVwiOnRydWV9fTtcbnJldHVybiBsZXhlcjt9KSgpXG5wYXJzZXIubGV4ZXIgPSBsZXhlcjtcbmZ1bmN0aW9uIFBhcnNlciAoKSB7IHRoaXMueXkgPSB7fTsgfVBhcnNlci5wcm90b3R5cGUgPSBwYXJzZXI7cGFyc2VyLlBhcnNlciA9IFBhcnNlcjtcbnJldHVybiBuZXcgUGFyc2VyO1xufSkoKTtleHBvcnRzW1wiZGVmYXVsdFwiXSA9IGhhbmRsZWJhcnM7XG4vKiBqc2hpbnQgaWdub3JlOmVuZCAqLyIsIlwidXNlIHN0cmljdFwiO1xudmFyIFZpc2l0b3IgPSByZXF1aXJlKFwiLi92aXNpdG9yXCIpW1wiZGVmYXVsdFwiXTtcblxuZnVuY3Rpb24gcHJpbnQoYXN0KSB7XG4gIHJldHVybiBuZXcgUHJpbnRWaXNpdG9yKCkuYWNjZXB0KGFzdCk7XG59XG5cbmV4cG9ydHMucHJpbnQgPSBwcmludDtmdW5jdGlvbiBQcmludFZpc2l0b3IoKSB7XG4gIHRoaXMucGFkZGluZyA9IDA7XG59XG5cbmV4cG9ydHMuUHJpbnRWaXNpdG9yID0gUHJpbnRWaXNpdG9yO1ByaW50VmlzaXRvci5wcm90b3R5cGUgPSBuZXcgVmlzaXRvcigpO1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLnBhZCA9IGZ1bmN0aW9uKHN0cmluZywgbmV3bGluZSkge1xuICB2YXIgb3V0ID0gXCJcIjtcblxuICBmb3IodmFyIGk9MCxsPXRoaXMucGFkZGluZzsgaTxsOyBpKyspIHtcbiAgICBvdXQgPSBvdXQgKyBcIiAgXCI7XG4gIH1cblxuICBvdXQgPSBvdXQgKyBzdHJpbmc7XG5cbiAgaWYobmV3bGluZSAhPT0gZmFsc2UpIHsgb3V0ID0gb3V0ICsgXCJcXG5cIjsgfVxuICByZXR1cm4gb3V0O1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5wcm9ncmFtID0gZnVuY3Rpb24ocHJvZ3JhbSkge1xuICB2YXIgb3V0ID0gXCJcIixcbiAgICAgIHN0YXRlbWVudHMgPSBwcm9ncmFtLnN0YXRlbWVudHMsXG4gICAgICBpLCBsO1xuXG4gIGZvcihpPTAsIGw9c3RhdGVtZW50cy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgb3V0ID0gb3V0ICsgdGhpcy5hY2NlcHQoc3RhdGVtZW50c1tpXSk7XG4gIH1cblxuICB0aGlzLnBhZGRpbmctLTtcblxuICByZXR1cm4gb3V0O1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5ibG9jayA9IGZ1bmN0aW9uKGJsb2NrKSB7XG4gIHZhciBvdXQgPSBcIlwiO1xuXG4gIG91dCA9IG91dCArIHRoaXMucGFkKFwiQkxPQ0s6XCIpO1xuICB0aGlzLnBhZGRpbmcrKztcbiAgb3V0ID0gb3V0ICsgdGhpcy5hY2NlcHQoYmxvY2subXVzdGFjaGUpO1xuICBpZiAoYmxvY2sucHJvZ3JhbSkge1xuICAgIG91dCA9IG91dCArIHRoaXMucGFkKFwiUFJPR1JBTTpcIik7XG4gICAgdGhpcy5wYWRkaW5nKys7XG4gICAgb3V0ID0gb3V0ICsgdGhpcy5hY2NlcHQoYmxvY2sucHJvZ3JhbSk7XG4gICAgdGhpcy5wYWRkaW5nLS07XG4gIH1cbiAgaWYgKGJsb2NrLmludmVyc2UpIHtcbiAgICBpZiAoYmxvY2sucHJvZ3JhbSkgeyB0aGlzLnBhZGRpbmcrKzsgfVxuICAgIG91dCA9IG91dCArIHRoaXMucGFkKFwie3tefX1cIik7XG4gICAgdGhpcy5wYWRkaW5nKys7XG4gICAgb3V0ID0gb3V0ICsgdGhpcy5hY2NlcHQoYmxvY2suaW52ZXJzZSk7XG4gICAgdGhpcy5wYWRkaW5nLS07XG4gICAgaWYgKGJsb2NrLnByb2dyYW0pIHsgdGhpcy5wYWRkaW5nLS07IH1cbiAgfVxuICB0aGlzLnBhZGRpbmctLTtcblxuICByZXR1cm4gb3V0O1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5zZXhwciA9IGZ1bmN0aW9uKHNleHByKSB7XG4gIHZhciBwYXJhbXMgPSBzZXhwci5wYXJhbXMsIHBhcmFtU3RyaW5ncyA9IFtdLCBoYXNoO1xuXG4gIGZvcih2YXIgaT0wLCBsPXBhcmFtcy5sZW5ndGg7IGk8bDsgaSsrKSB7XG4gICAgcGFyYW1TdHJpbmdzLnB1c2godGhpcy5hY2NlcHQocGFyYW1zW2ldKSk7XG4gIH1cblxuICBwYXJhbXMgPSBcIltcIiArIHBhcmFtU3RyaW5ncy5qb2luKFwiLCBcIikgKyBcIl1cIjtcblxuICBoYXNoID0gc2V4cHIuaGFzaCA/IFwiIFwiICsgdGhpcy5hY2NlcHQoc2V4cHIuaGFzaCkgOiBcIlwiO1xuXG4gIHJldHVybiB0aGlzLmFjY2VwdChzZXhwci5pZCkgKyBcIiBcIiArIHBhcmFtcyArIGhhc2g7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLm11c3RhY2hlID0gZnVuY3Rpb24obXVzdGFjaGUpIHtcbiAgcmV0dXJuIHRoaXMucGFkKFwie3sgXCIgKyB0aGlzLmFjY2VwdChtdXN0YWNoZS5zZXhwcikgKyBcIiB9fVwiKTtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUucGFydGlhbCA9IGZ1bmN0aW9uKHBhcnRpYWwpIHtcbiAgdmFyIGNvbnRlbnQgPSB0aGlzLmFjY2VwdChwYXJ0aWFsLnBhcnRpYWxOYW1lKTtcbiAgaWYocGFydGlhbC5jb250ZXh0KSB7IGNvbnRlbnQgPSBjb250ZW50ICsgXCIgXCIgKyB0aGlzLmFjY2VwdChwYXJ0aWFsLmNvbnRleHQpOyB9XG4gIHJldHVybiB0aGlzLnBhZChcInt7PiBcIiArIGNvbnRlbnQgKyBcIiB9fVwiKTtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuaGFzaCA9IGZ1bmN0aW9uKGhhc2gpIHtcbiAgdmFyIHBhaXJzID0gaGFzaC5wYWlycztcbiAgdmFyIGpvaW5lZFBhaXJzID0gW10sIGxlZnQsIHJpZ2h0O1xuXG4gIGZvcih2YXIgaT0wLCBsPXBhaXJzLmxlbmd0aDsgaTxsOyBpKyspIHtcbiAgICBsZWZ0ID0gcGFpcnNbaV1bMF07XG4gICAgcmlnaHQgPSB0aGlzLmFjY2VwdChwYWlyc1tpXVsxXSk7XG4gICAgam9pbmVkUGFpcnMucHVzaCggbGVmdCArIFwiPVwiICsgcmlnaHQgKTtcbiAgfVxuXG4gIHJldHVybiBcIkhBU0h7XCIgKyBqb2luZWRQYWlycy5qb2luKFwiLCBcIikgKyBcIn1cIjtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuU1RSSU5HID0gZnVuY3Rpb24oc3RyaW5nKSB7XG4gIHJldHVybiAnXCInICsgc3RyaW5nLnN0cmluZyArICdcIic7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLklOVEVHRVIgPSBmdW5jdGlvbihpbnRlZ2VyKSB7XG4gIHJldHVybiBcIklOVEVHRVJ7XCIgKyBpbnRlZ2VyLmludGVnZXIgKyBcIn1cIjtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuQk9PTEVBTiA9IGZ1bmN0aW9uKGJvb2wpIHtcbiAgcmV0dXJuIFwiQk9PTEVBTntcIiArIGJvb2wuYm9vbCArIFwifVwiO1xufTtcblxuUHJpbnRWaXNpdG9yLnByb3RvdHlwZS5JRCA9IGZ1bmN0aW9uKGlkKSB7XG4gIHZhciBwYXRoID0gaWQucGFydHMuam9pbihcIi9cIik7XG4gIGlmKGlkLnBhcnRzLmxlbmd0aCA+IDEpIHtcbiAgICByZXR1cm4gXCJQQVRIOlwiICsgcGF0aDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gXCJJRDpcIiArIHBhdGg7XG4gIH1cbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuUEFSVElBTF9OQU1FID0gZnVuY3Rpb24ocGFydGlhbE5hbWUpIHtcbiAgICByZXR1cm4gXCJQQVJUSUFMOlwiICsgcGFydGlhbE5hbWUubmFtZTtcbn07XG5cblByaW50VmlzaXRvci5wcm90b3R5cGUuREFUQSA9IGZ1bmN0aW9uKGRhdGEpIHtcbiAgcmV0dXJuIFwiQFwiICsgdGhpcy5hY2NlcHQoZGF0YS5pZCk7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLmNvbnRlbnQgPSBmdW5jdGlvbihjb250ZW50KSB7XG4gIHJldHVybiB0aGlzLnBhZChcIkNPTlRFTlRbICdcIiArIGNvbnRlbnQuc3RyaW5nICsgXCInIF1cIik7XG59O1xuXG5QcmludFZpc2l0b3IucHJvdG90eXBlLmNvbW1lbnQgPSBmdW5jdGlvbihjb21tZW50KSB7XG4gIHJldHVybiB0aGlzLnBhZChcInt7ISAnXCIgKyBjb21tZW50LmNvbW1lbnQgKyBcIicgfX1cIik7XG59OyIsIlwidXNlIHN0cmljdFwiO1xuZnVuY3Rpb24gVmlzaXRvcigpIHt9XG5cblZpc2l0b3IucHJvdG90eXBlID0ge1xuICBjb25zdHJ1Y3RvcjogVmlzaXRvcixcblxuICBhY2NlcHQ6IGZ1bmN0aW9uKG9iamVjdCkge1xuICAgIHJldHVybiB0aGlzW29iamVjdC50eXBlXShvYmplY3QpO1xuICB9XG59O1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IFZpc2l0b3I7IiwiXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBlcnJvclByb3BzID0gWydkZXNjcmlwdGlvbicsICdmaWxlTmFtZScsICdsaW5lTnVtYmVyJywgJ21lc3NhZ2UnLCAnbmFtZScsICdudW1iZXInLCAnc3RhY2snXTtcblxuZnVuY3Rpb24gRXhjZXB0aW9uKG1lc3NhZ2UsIG5vZGUpIHtcbiAgdmFyIGxpbmU7XG4gIGlmIChub2RlICYmIG5vZGUuZmlyc3RMaW5lKSB7XG4gICAgbGluZSA9IG5vZGUuZmlyc3RMaW5lO1xuXG4gICAgbWVzc2FnZSArPSAnIC0gJyArIGxpbmUgKyAnOicgKyBub2RlLmZpcnN0Q29sdW1uO1xuICB9XG5cbiAgdmFyIHRtcCA9IEVycm9yLnByb3RvdHlwZS5jb25zdHJ1Y3Rvci5jYWxsKHRoaXMsIG1lc3NhZ2UpO1xuXG4gIC8vIFVuZm9ydHVuYXRlbHkgZXJyb3JzIGFyZSBub3QgZW51bWVyYWJsZSBpbiBDaHJvbWUgKGF0IGxlYXN0KSwgc28gYGZvciBwcm9wIGluIHRtcGAgZG9lc24ndCB3b3JrLlxuICBmb3IgKHZhciBpZHggPSAwOyBpZHggPCBlcnJvclByb3BzLmxlbmd0aDsgaWR4KyspIHtcbiAgICB0aGlzW2Vycm9yUHJvcHNbaWR4XV0gPSB0bXBbZXJyb3JQcm9wc1tpZHhdXTtcbiAgfVxuXG4gIGlmIChsaW5lKSB7XG4gICAgdGhpcy5saW5lTnVtYmVyID0gbGluZTtcbiAgICB0aGlzLmNvbHVtbiA9IG5vZGUuZmlyc3RDb2x1bW47XG4gIH1cbn1cblxuRXhjZXB0aW9uLnByb3RvdHlwZSA9IG5ldyBFcnJvcigpO1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IEV4Y2VwdGlvbjsiLCJcInVzZSBzdHJpY3RcIjtcbnZhciBVdGlscyA9IHJlcXVpcmUoXCIuL3V0aWxzXCIpO1xudmFyIEV4Y2VwdGlvbiA9IHJlcXVpcmUoXCIuL2V4Y2VwdGlvblwiKVtcImRlZmF1bHRcIl07XG52YXIgQ09NUElMRVJfUkVWSVNJT04gPSByZXF1aXJlKFwiLi9iYXNlXCIpLkNPTVBJTEVSX1JFVklTSU9OO1xudmFyIFJFVklTSU9OX0NIQU5HRVMgPSByZXF1aXJlKFwiLi9iYXNlXCIpLlJFVklTSU9OX0NIQU5HRVM7XG5cbmZ1bmN0aW9uIGNoZWNrUmV2aXNpb24oY29tcGlsZXJJbmZvKSB7XG4gIHZhciBjb21waWxlclJldmlzaW9uID0gY29tcGlsZXJJbmZvICYmIGNvbXBpbGVySW5mb1swXSB8fCAxLFxuICAgICAgY3VycmVudFJldmlzaW9uID0gQ09NUElMRVJfUkVWSVNJT047XG5cbiAgaWYgKGNvbXBpbGVyUmV2aXNpb24gIT09IGN1cnJlbnRSZXZpc2lvbikge1xuICAgIGlmIChjb21waWxlclJldmlzaW9uIDwgY3VycmVudFJldmlzaW9uKSB7XG4gICAgICB2YXIgcnVudGltZVZlcnNpb25zID0gUkVWSVNJT05fQ0hBTkdFU1tjdXJyZW50UmV2aXNpb25dLFxuICAgICAgICAgIGNvbXBpbGVyVmVyc2lvbnMgPSBSRVZJU0lPTl9DSEFOR0VTW2NvbXBpbGVyUmV2aXNpb25dO1xuICAgICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIlRlbXBsYXRlIHdhcyBwcmVjb21waWxlZCB3aXRoIGFuIG9sZGVyIHZlcnNpb24gb2YgSGFuZGxlYmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuIFwiK1xuICAgICAgICAgICAgXCJQbGVhc2UgdXBkYXRlIHlvdXIgcHJlY29tcGlsZXIgdG8gYSBuZXdlciB2ZXJzaW9uIChcIitydW50aW1lVmVyc2lvbnMrXCIpIG9yIGRvd25ncmFkZSB5b3VyIHJ1bnRpbWUgdG8gYW4gb2xkZXIgdmVyc2lvbiAoXCIrY29tcGlsZXJWZXJzaW9ucytcIikuXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBVc2UgdGhlIGVtYmVkZGVkIHZlcnNpb24gaW5mbyBzaW5jZSB0aGUgcnVudGltZSBkb2Vzbid0IGtub3cgYWJvdXQgdGhpcyByZXZpc2lvbiB5ZXRcbiAgICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUZW1wbGF0ZSB3YXMgcHJlY29tcGlsZWQgd2l0aCBhIG5ld2VyIHZlcnNpb24gb2YgSGFuZGxlYmFycyB0aGFuIHRoZSBjdXJyZW50IHJ1bnRpbWUuIFwiK1xuICAgICAgICAgICAgXCJQbGVhc2UgdXBkYXRlIHlvdXIgcnVudGltZSB0byBhIG5ld2VyIHZlcnNpb24gKFwiK2NvbXBpbGVySW5mb1sxXStcIikuXCIpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnRzLmNoZWNrUmV2aXNpb24gPSBjaGVja1JldmlzaW9uOy8vIFRPRE86IFJlbW92ZSB0aGlzIGxpbmUgYW5kIGJyZWFrIHVwIGNvbXBpbGVQYXJ0aWFsXG5cbmZ1bmN0aW9uIHRlbXBsYXRlKHRlbXBsYXRlU3BlYywgZW52KSB7XG4gIGlmICghZW52KSB7XG4gICAgdGhyb3cgbmV3IEV4Y2VwdGlvbihcIk5vIGVudmlyb25tZW50IHBhc3NlZCB0byB0ZW1wbGF0ZVwiKTtcbiAgfVxuXG4gIC8vIE5vdGU6IFVzaW5nIGVudi5WTSByZWZlcmVuY2VzIHJhdGhlciB0aGFuIGxvY2FsIHZhciByZWZlcmVuY2VzIHRocm91Z2hvdXQgdGhpcyBzZWN0aW9uIHRvIGFsbG93XG4gIC8vIGZvciBleHRlcm5hbCB1c2VycyB0byBvdmVycmlkZSB0aGVzZSBhcyBwc3VlZG8tc3VwcG9ydGVkIEFQSXMuXG4gIHZhciBpbnZva2VQYXJ0aWFsV3JhcHBlciA9IGZ1bmN0aW9uKHBhcnRpYWwsIG5hbWUsIGNvbnRleHQsIGhlbHBlcnMsIHBhcnRpYWxzLCBkYXRhKSB7XG4gICAgdmFyIHJlc3VsdCA9IGVudi5WTS5pbnZva2VQYXJ0aWFsLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgaWYgKHJlc3VsdCAhPSBudWxsKSB7IHJldHVybiByZXN1bHQ7IH1cblxuICAgIGlmIChlbnYuY29tcGlsZSkge1xuICAgICAgdmFyIG9wdGlvbnMgPSB7IGhlbHBlcnM6IGhlbHBlcnMsIHBhcnRpYWxzOiBwYXJ0aWFscywgZGF0YTogZGF0YSB9O1xuICAgICAgcGFydGlhbHNbbmFtZV0gPSBlbnYuY29tcGlsZShwYXJ0aWFsLCB7IGRhdGE6IGRhdGEgIT09IHVuZGVmaW5lZCB9LCBlbnYpO1xuICAgICAgcmV0dXJuIHBhcnRpYWxzW25hbWVdKGNvbnRleHQsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXhjZXB0aW9uKFwiVGhlIHBhcnRpYWwgXCIgKyBuYW1lICsgXCIgY291bGQgbm90IGJlIGNvbXBpbGVkIHdoZW4gcnVubmluZyBpbiBydW50aW1lLW9ubHkgbW9kZVwiKTtcbiAgICB9XG4gIH07XG5cbiAgLy8gSnVzdCBhZGQgd2F0ZXJcbiAgdmFyIGNvbnRhaW5lciA9IHtcbiAgICBlc2NhcGVFeHByZXNzaW9uOiBVdGlscy5lc2NhcGVFeHByZXNzaW9uLFxuICAgIGludm9rZVBhcnRpYWw6IGludm9rZVBhcnRpYWxXcmFwcGVyLFxuICAgIHByb2dyYW1zOiBbXSxcbiAgICBwcm9ncmFtOiBmdW5jdGlvbihpLCBmbiwgZGF0YSkge1xuICAgICAgdmFyIHByb2dyYW1XcmFwcGVyID0gdGhpcy5wcm9ncmFtc1tpXTtcbiAgICAgIGlmKGRhdGEpIHtcbiAgICAgICAgcHJvZ3JhbVdyYXBwZXIgPSBwcm9ncmFtKGksIGZuLCBkYXRhKTtcbiAgICAgIH0gZWxzZSBpZiAoIXByb2dyYW1XcmFwcGVyKSB7XG4gICAgICAgIHByb2dyYW1XcmFwcGVyID0gdGhpcy5wcm9ncmFtc1tpXSA9IHByb2dyYW0oaSwgZm4pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHByb2dyYW1XcmFwcGVyO1xuICAgIH0sXG4gICAgbWVyZ2U6IGZ1bmN0aW9uKHBhcmFtLCBjb21tb24pIHtcbiAgICAgIHZhciByZXQgPSBwYXJhbSB8fCBjb21tb247XG5cbiAgICAgIGlmIChwYXJhbSAmJiBjb21tb24gJiYgKHBhcmFtICE9PSBjb21tb24pKSB7XG4gICAgICAgIHJldCA9IHt9O1xuICAgICAgICBVdGlscy5leHRlbmQocmV0LCBjb21tb24pO1xuICAgICAgICBVdGlscy5leHRlbmQocmV0LCBwYXJhbSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmV0O1xuICAgIH0sXG4gICAgcHJvZ3JhbVdpdGhEZXB0aDogZW52LlZNLnByb2dyYW1XaXRoRGVwdGgsXG4gICAgbm9vcDogZW52LlZNLm5vb3AsXG4gICAgY29tcGlsZXJJbmZvOiBudWxsXG4gIH07XG5cbiAgcmV0dXJuIGZ1bmN0aW9uKGNvbnRleHQsIG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgICB2YXIgbmFtZXNwYWNlID0gb3B0aW9ucy5wYXJ0aWFsID8gb3B0aW9ucyA6IGVudixcbiAgICAgICAgaGVscGVycyxcbiAgICAgICAgcGFydGlhbHM7XG5cbiAgICBpZiAoIW9wdGlvbnMucGFydGlhbCkge1xuICAgICAgaGVscGVycyA9IG9wdGlvbnMuaGVscGVycztcbiAgICAgIHBhcnRpYWxzID0gb3B0aW9ucy5wYXJ0aWFscztcbiAgICB9XG4gICAgdmFyIHJlc3VsdCA9IHRlbXBsYXRlU3BlYy5jYWxsKFxuICAgICAgICAgIGNvbnRhaW5lcixcbiAgICAgICAgICBuYW1lc3BhY2UsIGNvbnRleHQsXG4gICAgICAgICAgaGVscGVycyxcbiAgICAgICAgICBwYXJ0aWFscyxcbiAgICAgICAgICBvcHRpb25zLmRhdGEpO1xuXG4gICAgaWYgKCFvcHRpb25zLnBhcnRpYWwpIHtcbiAgICAgIGVudi5WTS5jaGVja1JldmlzaW9uKGNvbnRhaW5lci5jb21waWxlckluZm8pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG59XG5cbmV4cG9ydHMudGVtcGxhdGUgPSB0ZW1wbGF0ZTtmdW5jdGlvbiBwcm9ncmFtV2l0aERlcHRoKGksIGZuLCBkYXRhIC8qLCAkZGVwdGggKi8pIHtcbiAgdmFyIGFyZ3MgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDMpO1xuXG4gIHZhciBwcm9nID0gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIFtjb250ZXh0LCBvcHRpb25zLmRhdGEgfHwgZGF0YV0uY29uY2F0KGFyZ3MpKTtcbiAgfTtcbiAgcHJvZy5wcm9ncmFtID0gaTtcbiAgcHJvZy5kZXB0aCA9IGFyZ3MubGVuZ3RoO1xuICByZXR1cm4gcHJvZztcbn1cblxuZXhwb3J0cy5wcm9ncmFtV2l0aERlcHRoID0gcHJvZ3JhbVdpdGhEZXB0aDtmdW5jdGlvbiBwcm9ncmFtKGksIGZuLCBkYXRhKSB7XG4gIHZhciBwcm9nID0gZnVuY3Rpb24oY29udGV4dCwgb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgcmV0dXJuIGZuKGNvbnRleHQsIG9wdGlvbnMuZGF0YSB8fCBkYXRhKTtcbiAgfTtcbiAgcHJvZy5wcm9ncmFtID0gaTtcbiAgcHJvZy5kZXB0aCA9IDA7XG4gIHJldHVybiBwcm9nO1xufVxuXG5leHBvcnRzLnByb2dyYW0gPSBwcm9ncmFtO2Z1bmN0aW9uIGludm9rZVBhcnRpYWwocGFydGlhbCwgbmFtZSwgY29udGV4dCwgaGVscGVycywgcGFydGlhbHMsIGRhdGEpIHtcbiAgdmFyIG9wdGlvbnMgPSB7IHBhcnRpYWw6IHRydWUsIGhlbHBlcnM6IGhlbHBlcnMsIHBhcnRpYWxzOiBwYXJ0aWFscywgZGF0YTogZGF0YSB9O1xuXG4gIGlmKHBhcnRpYWwgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFeGNlcHRpb24oXCJUaGUgcGFydGlhbCBcIiArIG5hbWUgKyBcIiBjb3VsZCBub3QgYmUgZm91bmRcIik7XG4gIH0gZWxzZSBpZihwYXJ0aWFsIGluc3RhbmNlb2YgRnVuY3Rpb24pIHtcbiAgICByZXR1cm4gcGFydGlhbChjb250ZXh0LCBvcHRpb25zKTtcbiAgfVxufVxuXG5leHBvcnRzLmludm9rZVBhcnRpYWwgPSBpbnZva2VQYXJ0aWFsO2Z1bmN0aW9uIG5vb3AoKSB7IHJldHVybiBcIlwiOyB9XG5cbmV4cG9ydHMubm9vcCA9IG5vb3A7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vLyBCdWlsZCBvdXQgb3VyIGJhc2ljIFNhZmVTdHJpbmcgdHlwZVxuZnVuY3Rpb24gU2FmZVN0cmluZyhzdHJpbmcpIHtcbiAgdGhpcy5zdHJpbmcgPSBzdHJpbmc7XG59XG5cblNhZmVTdHJpbmcucHJvdG90eXBlLnRvU3RyaW5nID0gZnVuY3Rpb24oKSB7XG4gIHJldHVybiBcIlwiICsgdGhpcy5zdHJpbmc7XG59O1xuXG5leHBvcnRzW1wiZGVmYXVsdFwiXSA9IFNhZmVTdHJpbmc7IiwiXCJ1c2Ugc3RyaWN0XCI7XG4vKmpzaGludCAtVzAwNCAqL1xudmFyIFNhZmVTdHJpbmcgPSByZXF1aXJlKFwiLi9zYWZlLXN0cmluZ1wiKVtcImRlZmF1bHRcIl07XG5cbnZhciBlc2NhcGUgPSB7XG4gIFwiJlwiOiBcIiZhbXA7XCIsXG4gIFwiPFwiOiBcIiZsdDtcIixcbiAgXCI+XCI6IFwiJmd0O1wiLFxuICAnXCInOiBcIiZxdW90O1wiLFxuICBcIidcIjogXCImI3gyNztcIixcbiAgXCJgXCI6IFwiJiN4NjA7XCJcbn07XG5cbnZhciBiYWRDaGFycyA9IC9bJjw+XCInYF0vZztcbnZhciBwb3NzaWJsZSA9IC9bJjw+XCInYF0vO1xuXG5mdW5jdGlvbiBlc2NhcGVDaGFyKGNocikge1xuICByZXR1cm4gZXNjYXBlW2Nocl0gfHwgXCImYW1wO1wiO1xufVxuXG5mdW5jdGlvbiBleHRlbmQob2JqLCB2YWx1ZSkge1xuICBmb3IodmFyIGtleSBpbiB2YWx1ZSkge1xuICAgIGlmKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbCh2YWx1ZSwga2V5KSkge1xuICAgICAgb2JqW2tleV0gPSB2YWx1ZVtrZXldO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnRzLmV4dGVuZCA9IGV4dGVuZDt2YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xuZXhwb3J0cy50b1N0cmluZyA9IHRvU3RyaW5nO1xuLy8gU291cmNlZCBmcm9tIGxvZGFzaFxuLy8gaHR0cHM6Ly9naXRodWIuY29tL2Jlc3RpZWpzL2xvZGFzaC9ibG9iL21hc3Rlci9MSUNFTlNFLnR4dFxudmFyIGlzRnVuY3Rpb24gPSBmdW5jdGlvbih2YWx1ZSkge1xuICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nO1xufTtcbi8vIGZhbGxiYWNrIGZvciBvbGRlciB2ZXJzaW9ucyBvZiBDaHJvbWUgYW5kIFNhZmFyaVxuaWYgKGlzRnVuY3Rpb24oL3gvKSkge1xuICBpc0Z1bmN0aW9uID0gZnVuY3Rpb24odmFsdWUpIHtcbiAgICByZXR1cm4gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nICYmIHRvU3RyaW5nLmNhbGwodmFsdWUpID09PSAnW29iamVjdCBGdW5jdGlvbl0nO1xuICB9O1xufVxudmFyIGlzRnVuY3Rpb247XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xudmFyIGlzQXJyYXkgPSBBcnJheS5pc0FycmF5IHx8IGZ1bmN0aW9uKHZhbHVlKSB7XG4gIHJldHVybiAodmFsdWUgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JykgPyB0b1N0cmluZy5jYWxsKHZhbHVlKSA9PT0gJ1tvYmplY3QgQXJyYXldJyA6IGZhbHNlO1xufTtcbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGVzY2FwZUV4cHJlc3Npb24oc3RyaW5nKSB7XG4gIC8vIGRvbid0IGVzY2FwZSBTYWZlU3RyaW5ncywgc2luY2UgdGhleSdyZSBhbHJlYWR5IHNhZmVcbiAgaWYgKHN0cmluZyBpbnN0YW5jZW9mIFNhZmVTdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnRvU3RyaW5nKCk7XG4gIH0gZWxzZSBpZiAoIXN0cmluZyAmJiBzdHJpbmcgIT09IDApIHtcbiAgICByZXR1cm4gXCJcIjtcbiAgfVxuXG4gIC8vIEZvcmNlIGEgc3RyaW5nIGNvbnZlcnNpb24gYXMgdGhpcyB3aWxsIGJlIGRvbmUgYnkgdGhlIGFwcGVuZCByZWdhcmRsZXNzIGFuZFxuICAvLyB0aGUgcmVnZXggdGVzdCB3aWxsIGRvIHRoaXMgdHJhbnNwYXJlbnRseSBiZWhpbmQgdGhlIHNjZW5lcywgY2F1c2luZyBpc3N1ZXMgaWZcbiAgLy8gYW4gb2JqZWN0J3MgdG8gc3RyaW5nIGhhcyBlc2NhcGVkIGNoYXJhY3RlcnMgaW4gaXQuXG4gIHN0cmluZyA9IFwiXCIgKyBzdHJpbmc7XG5cbiAgaWYoIXBvc3NpYmxlLnRlc3Qoc3RyaW5nKSkgeyByZXR1cm4gc3RyaW5nOyB9XG4gIHJldHVybiBzdHJpbmcucmVwbGFjZShiYWRDaGFycywgZXNjYXBlQ2hhcik7XG59XG5cbmV4cG9ydHMuZXNjYXBlRXhwcmVzc2lvbiA9IGVzY2FwZUV4cHJlc3Npb247ZnVuY3Rpb24gaXNFbXB0eSh2YWx1ZSkge1xuICBpZiAoIXZhbHVlICYmIHZhbHVlICE9PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSBpZiAoaXNBcnJheSh2YWx1ZSkgJiYgdmFsdWUubGVuZ3RoID09PSAwKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG5cbmV4cG9ydHMuaXNFbXB0eSA9IGlzRW1wdHk7IiwiLy8gVVNBR0U6XG4vLyB2YXIgaGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hhbmRsZWJhcnMnKTtcblxuLy8gdmFyIGxvY2FsID0gaGFuZGxlYmFycy5jcmVhdGUoKTtcblxudmFyIGhhbmRsZWJhcnMgPSByZXF1aXJlKCcuLi9kaXN0L2Nqcy9oYW5kbGViYXJzJylbXCJkZWZhdWx0XCJdO1xuXG5oYW5kbGViYXJzLlZpc2l0b3IgPSByZXF1aXJlKCcuLi9kaXN0L2Nqcy9oYW5kbGViYXJzL2NvbXBpbGVyL3Zpc2l0b3InKVtcImRlZmF1bHRcIl07XG5cbnZhciBwcmludGVyID0gcmVxdWlyZSgnLi4vZGlzdC9janMvaGFuZGxlYmFycy9jb21waWxlci9wcmludGVyJyk7XG5oYW5kbGViYXJzLlByaW50VmlzaXRvciA9IHByaW50ZXIuUHJpbnRWaXNpdG9yO1xuaGFuZGxlYmFycy5wcmludCA9IHByaW50ZXIucHJpbnQ7XG5cbm1vZHVsZS5leHBvcnRzID0gaGFuZGxlYmFycztcblxuLy8gUHVibGlzaCBhIE5vZGUuanMgcmVxdWlyZSgpIGhhbmRsZXIgZm9yIC5oYW5kbGViYXJzIGFuZCAuaGJzIGZpbGVzXG5pZiAodHlwZW9mIHJlcXVpcmUgIT09ICd1bmRlZmluZWQnICYmIHJlcXVpcmUuZXh0ZW5zaW9ucykge1xuICB2YXIgZXh0ZW5zaW9uID0gZnVuY3Rpb24obW9kdWxlLCBmaWxlbmFtZSkge1xuICAgIHZhciBmcyA9IHJlcXVpcmUoXCJmc1wiKTtcbiAgICB2YXIgdGVtcGxhdGVTdHJpbmcgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZW5hbWUsIFwidXRmOFwiKTtcbiAgICBtb2R1bGUuZXhwb3J0cyA9IGhhbmRsZWJhcnMuY29tcGlsZSh0ZW1wbGF0ZVN0cmluZyk7XG4gIH07XG4gIHJlcXVpcmUuZXh0ZW5zaW9uc1tcIi5oYW5kbGViYXJzXCJdID0gZXh0ZW5zaW9uO1xuICByZXF1aXJlLmV4dGVuc2lvbnNbXCIuaGJzXCJdID0gZXh0ZW5zaW9uO1xufVxuIiwiLy8gQ3JlYXRlIGEgc2ltcGxlIHBhdGggYWxpYXMgdG8gYWxsb3cgYnJvd3NlcmlmeSB0byByZXNvbHZlXG4vLyB0aGUgcnVudGltZSBvbiBhIHN1cHBvcnRlZCBwYXRoLlxubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2Rpc3QvY2pzL2hhbmRsZWJhcnMucnVudGltZScpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiaGFuZGxlYmFycy9ydW50aW1lXCIpW1wiZGVmYXVsdFwiXTtcbiIsIm9iamVjdCA9IHt9XG5tb2R1bGUuZXhwb3J0cyA9IG9iamVjdFxuXG5cbiMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjXG4jIyMgICBQQVJMRVkuSlMgQ0hBVCBMSUJSQVJZIEVYVFJPRElOQUlSRSAgICMjI1xuIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyNcblxuXG4jIyB0aGlzIGlzIHRoZSBjb250cnVjdG9yIGZvciB0aGUgZ2xvYmFsIG9iamVjdCB0aGF0IHdoZW4gaW5pdGlhbGl6ZWRcbiMjIGV4ZWN1dGVzIGFsbCBuZWNjZXNhcnkgb3BlcmF0aW9ucyB0byBnZXQgdGhpcyB0cmFpbiBtb3ZpbmcuXG5jbGFzcyBBcHBcblxuICBjb25zdHJ1Y3RvcjogLT5cbiAgICBAY3VycmVudF91c2VycyA9IFtdXG4gICAgQG9wZW5fY29udmVyc2F0aW9ucyA9IFtdXG4gICAgQGNvbnZlcnNhdGlvbnMgPSBbXVxuXG4gICAgIyMgaW5zZXJ0IHNjcmlwdCBmb3Igc29ja2V0LmlvIGNvbm5lY3Rpb25zXG4gICAgZG8gLT5cbiAgICAgIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpXG4gICAgICBzY3JpcHQudHlwZSA9ICd0ZXh0L2phdmFzY3JpcHQnXG4gICAgICBzY3JpcHQuYXN5bmMgPSB0cnVlXG4gICAgICBzY3JpcHQuc3JjID0gXCIvc29ja2V0LmlvL3NvY2tldC5pby5qc1wiXG4gICAgICBzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdXG4gICAgICBzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHNjcmlwdCwgcylcblxuICAgICMjIGluc2VydCBzY3JpcHQgZm9yIGdvb2dsZSBwbHVzIHNpZ25pblxuICAgIGRvIC0+XG4gICAgICBwbyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpXG4gICAgICBwby50eXBlID0gJ3RleHQvamF2YXNjcmlwdCdcbiAgICAgIHBvLmFzeW5jID0gdHJ1ZVxuICAgICAgcG8uc3JjID0gJ2h0dHBzOi8vYXBpcy5nb29nbGUuY29tL2pzL2NsaWVudDpwbHVzb25lLmpzJ1xuICAgICAgcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzY3JpcHQnKVswXVxuICAgICAgcy5wYXJlbnROb2RlLmluc2VydEJlZm9yZShwbywgcylcblxuICAgICMjIGxpc3RlbiBmb3IgcGVyc2lzdGVudCBjb252ZXJzYXRpb25zIGZyb20gdGhlIHNlcnZlciBvbiBsb2FkLlxuICAgICMjIHdpbGwgYmUgc2VudCBpbiBvbmUgYXQgYSB0aW1lIGZyb20gcmVkaXMgb24gbG9hZC5cbiAgICBAc2VydmVyLm9uICdwZXJzaXN0ZW50X2NvbnZvJywgQGxvYWRfcGVyc2lzdGVudF9jb252by5iaW5kKHRoaXMpXG4gICAgIyMgbGlzdGVucyBmb3IgbWVzc2FnZXMgc2VuZCB0byBjbG9zZWQgY29udmVyc2F0aW9ucyBvciBuZXcgY29udmVyc2F0aW9uc1xuICAgIEBzZXJ2ZXIub24gJ21lc3NhZ2UnLCBAdXBkYXRlX3BlcnNpc3RlbnRfY29udm9zLmJpbmQodGhpcylcblxuICAgICMjIGxpc3RlbnMgZm9yIGN1cnJlbnQgdXNlcnMgYXJyYXkgZnJvbSBzZXJ2ZXJcbiAgICBAc2VydmVyLm9uICdjdXJyZW50X3VzZXJzJywgQGxvYWRfY3VycmVudF91c2Vycy5iaW5kKHRoaXMpXG4gICAgQHNlcnZlci5vbiAndXNlcl9sb2dnZWRfb24nLCBAdXNlcl9sb2dnZWRfb24uYmluZCh0aGlzKVxuICAgIEBzZXJ2ZXIub24gJ3VzZXJfbG9nZ2VkX29mZicsIEB1c2VyX2xvZ2dlZF9vZmYuYmluZCh0aGlzKVxuXG4gIHNlcnZlcjogaW8uY29ubmVjdCgnd3NzOi8vJyArIHdpbmRvdy5sb2NhdGlvbi5ob3N0bmFtZSlcblxuXG4gIGxvYWRfcGVyc2lzdGVudF9jb252bzogKGNvbnZvX3BhcnRuZXJzLCBtZXNzYWdlcykgLT5cbiAgICAjIyB0YWtlcyBwYXNzZWQgaW4gY29udm8gbWVtYmVycyBhbmQgcmVtb3ZlIGNsaWVudCBvYmplY3QgZnJvbSBhcnJheS5cbiAgICAjIGNvbnZvX3BhcnRuZXJzID0gW11cbiAgICAjIGZvciBtZW1iZXIsIGkgaW4gY29udm9fbWVtYmVyc1xuICAgICMgICBpZiBtZW1iZXIuaW1hZ2VfdXJsIGlzbnQgQG1lLmltYWdlX3VybFxuICAgICMgICAgIGNvbnZvX3BhcnRuZXJzLnB1c2gobWVtYmVyKVxuICAgICMjIGNyZWF0ZSBtZXNzYWdlIGFycmF5IHRoYXQgaXMgcGFyc2VkIGFuZCByZWFzc2lnbmVkIGFzIGEgbWVzc2FnZVxuICAgIHBhcnNlZF9tZXNzYWdlcyA9IFtdXG4gICAgZm9yIG1lc3NhZ2UgaW4gbWVzc2FnZXNcbiAgICAgIHBhcnNlZCA9IEpTT04ucGFyc2UobWVzc2FnZSlcbiAgICAgIG5ld19tZXNzYWdlID0gbmV3IE1lc3NhZ2UocGFyc2VkLnJlY2lwaWVudHMsIHBhcnNlZC5zZW5kZXIsIHBhcnNlZC5jb250ZW50LCBwYXJzZWQuaW1hZ2UsIHBhcnNlZC50aW1lX3N0YW1wKVxuICAgICAgcGFyc2VkX21lc3NhZ2VzLnB1c2gobmV3X21lc3NhZ2UpXG5cbiAgICAjIyBjcmVhdGUgbmV3IGNvbnZlcnNhdGlvbiBvYmplY3QgZnJvbSBwZXJzaXN0ZW50IGNvbnZlcnNhdGlvbiBpbmZvXG4gICAgY29udm8gPSBuZXcgQ29udmVyc2F0aW9uKGNvbnZvX3BhcnRuZXJzLCBwYXJzZWRfbWVzc2FnZXMpXG4gICAgQGNvbnZlcnNhdGlvbnMucHVzaChjb252bylcblxuICB1cGRhdGVfcGVyc2lzdGVudF9jb252b3M6IChtZXNzYWdlKSAtPlxuICAgIGNvbnNvbGUubG9nKFwiaSBoZWFyIHlvdSBjbGlja1wiKVxuICAgICMjIG9ubHkgdXBkYXRlIGlmIGNvbnZvIGRvZXNuJ3QgZXhpc3Qgb3IgaXMgbm90IGN1cnJlbnRseSBvcGVuXG4gICAgZm9yIG9wZW5fY29udm8gaW4gQG9wZW5fY29udmVyc2F0aW9uc1xuICAgICAgaWYgbWVzc2FnZS5jb252b19pZCBpcyBvcGVuX2NvbnZvXG4gICAgICAgIHJldHVyblxuICAgIGNvbnNvbGUubG9nKCdpIGtub3cgdGhlIGNvbnZvIGlzbnQgb3BlbicpXG4gICAgIyMgZmluZCBpZiBjb252byBleGlzdHNcbiAgICBmb3IgY29udm8gaW4gQGNvbnZlcnNhdGlvbnNcbiAgICAgIGlmIGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIG1lc3NhZ2UuY29udm9faWRcbiAgICAgICAgY29ycmVzX2NvbnZvID0gY29udm9cblxuICAgIG5ld19tZXNzYWdlID0gbmV3IE1lc3NhZ2UobWVzc2FnZS5yZWNpcGllbnRzLCBtZXNzYWdlLnNlbmRlciwgbWVzc2FnZS5jb250ZW50LCBtZXNzYWdlLmltYWdlLCBtZXNzYWdlLnRpbWVfc3RhbXApXG4gICAgIyMgaWYgY29udm8gZXhpc3RzXG4gICAgaWYgY29ycmVzX2NvbnZvXG4gICAgICBjb3JyZXNfY29udm8uYWRkX21lc3NhZ2UobmV3X21lc3NhZ2UpXG4gICAgICBjb25zb2xlLmxvZyhcIkkgdGhpbmsgdGhlIGNvbnZvIGV4aXN0c1wiKVxuICAgIGVsc2VcbiAgICAgIGNvbnNvbGUubG9nKFwiSSB0aGluayB0aGUgY29udm8gZG9lc24ndCBleGlzdFwiKVxuICAgICAgIyMgbG9naWMgdG8gZXh0cmFjdCBpbmZvIGZyb20gbWVzc2FnZSB0byBjcmVhdGUgbmV3IGNvbnZvXG4gICAgICBjb252b19tZW1iZXJzX2lkcyA9IG5ld19tZXNzYWdlLmNvbnZvX2lkLnNwbGl0KCcsJylcbiAgICAgICMjIHJlbW92ZSBzZWxmIGZyb20gYXJyYXkgdG8gY29uc3RydWN0IGNvbnZvIHBhcnRuZXJzXG4gICAgICBmb3IgdXNlcl9pZCwgaSBpbiBjb252b19tZW1iZXJzX2lkc1xuICAgICAgICBpZiB1c2VyX2lkIGlzIEBtZS5pbWFnZV91cmxcbiAgICAgICAgICBjb252b19tZW1iZXJzX2lkcy5zcGxpY2UoaSwxKVxuXG4gICAgICAjIyB1c2UgaWRzIHRvIGdyYWIgZnVsbCBvYmplY3RzIGZvciBjb252byBwYXJ0bmVyc1xuICAgICAgY29udm9fcGFydG5lcnMgPSBbXVxuICAgICAgZm9yIHVzZXJfaWQgaW4gY29udm9fbWVtYmVyc19pZHNcbiAgICAgICAgZm9yIG9ubGluZV91c2VyIGluIEBjdXJyZW50X3VzZXJzXG4gICAgICAgICAgaWYgdXNlcl9pZCBpcyBvbmxpbmVfdXNlci5pbWFnZV91cmxcbiAgICAgICAgICAgIGNvbnZvX3BhcnRuZXJzLnB1c2gob25saW5lX3VzZXIpXG5cbiAgICAgICMjIGNyZWF0ZSBuZXcgY29udm8gYW5kIGFkZCBtZXNzYWdlXG4gICAgICBuZXdfY29udm8gPSBuZXcgQ29udmVyc2F0aW9uKGNvbnZvX3BhcnRuZXJzKVxuICAgICAgQGNvbnZlcnNhdGlvbnMucHVzaChuZXdfY29udm8pXG4gICAgICBuZXdfY29udm8uYWRkX21lc3NhZ2UobmV3X21lc3NhZ2UpXG4gICAgICBjb25zb2xlLmxvZyhAY29udmVyc2F0aW9ucylcblxuICBsb2FkX2N1cnJlbnRfdXNlcnM6IChsb2dnZWRfb24pIC0+XG4gICAgIyMgcmVjaWV2ZXMgY3VycmVudCB1c2VycyBmcm9tIHNlcnZlciBvbiBsb2dpblxuICAgIEBjdXJyZW50X3VzZXJzID0gbG9nZ2VkX29uXG4gICAgZm9yIHVzZXIsIGkgaW4gQGN1cnJlbnRfdXNlcnNcbiAgICAgIGlmIHVzZXIuaW1hZ2VfdXJsIGlzIEBtZS5pbWFnZV91cmxcbiAgICAgICAgQGN1cnJlbnRfdXNlcnMuc3BsaWNlKGksMSlcblxuICB1c2VyX2xvZ2dlZF9vbjogKGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsKSAtPlxuICAgIHVzZXIgPSBuZXcgVXNlcihkaXNwbGF5X25hbWUsIGltYWdlX3VybClcbiAgICBAY3VycmVudF91c2Vycy5wdXNoKHVzZXIpXG5cbiAgdXNlcl9sb2dnZWRfb2ZmOiAoZGlzcGxheV9uYW1lLCBpbWFnZV91cmwpIC0+XG4gICAgY29uc29sZS5sb2coQGN1cnJlbnRfdXNlcnMpXG4gICAgZm9yIHVzZXIsIGkgaW4gQGN1cnJlbnRfdXNlcnNcbiAgICAgIGlmIGltYWdlX3VybCBpcyB1c2VyLmltYWdlX3VybFxuICAgICAgICBAY3VycmVudF91c2Vycy5zcGxpY2UoIGksIDEpXG4gICAgY29uc29sZS5sb2coQGN1cnJlbnRfdXNlcnMpXG5cblxuIyMgU0FUSVNGSUVTIENJUkNVTEFSIERFUEVOREFOQ1kgRk9SIEJST1dTRVJJRlkgQlVORExJTkdcbnBhcmxleSA9IG5ldyBBcHAoKVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcmxleVxuXG4jIyBMT0FEIENPTU1BTkRDRU5URVIgQU5EIE9BVVRIIFRPIFNUQVJUIEFQUFxub2F1dGggPSByZXF1aXJlKCcuL29hdXRoLmNvZmZlZScpXG5jb21tYW5kX2NlbnRlciA9IHJlcXVpcmUoJy4vY29tbWFuZF9jZW50ZXJfdmlldy5jb2ZmZWUnKVxuQ29udmVyc2F0aW9uID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb25fbW9kZWwuY29mZmVlJylcblVzZXIgPSByZXF1aXJlKCcuL3VzZXJfbW9kZWwuY29mZmVlJylcbk1lc3NhZ2UgPSByZXF1aXJlKCcuL21lc3NhZ2VfbW9kZWwuY29mZmVlJylcbkFwcC5wcm90b3R5cGUuY29tbWFuZF9jZW50ZXIgPSBjb21tYW5kX2NlbnRlclxuQXBwLnByb3RvdHlwZS5vYXV0aCA9IG9hdXRoXG5cblxuXG5cbiIsImFwcCA9IHJlcXVpcmUoJy4vYXBwLmNvZmZlZScpXG5NZXNzYWdlID0gcmVxdWlyZSgnLi9tZXNzYWdlX21vZGVsLmNvZmZlZScpXG5NZXNzYWdlVmlldyA9IHJlcXVpcmUoJy4vbWVzc2FnZV92aWV3LmNvZmZlZScpXG5Db252ZXJzYXRpb24gPSByZXF1aXJlKCcuL2NvbnZlcnNhdGlvbl9tb2RlbC5jb2ZmZWUnKVxuY2hhdF9yb29tX3RlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZXMvY2hhdF9yb29tLmhicycpXG5IYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyICd0aXRsZV9iYXJfZnVuY3Rpb24nLCAtPlxuICBpZiBAY29udm9fcGFydG5lcnMubGVuZ3RoIDwgMlxuICAgIHJldHVybiBAY29udm9fcGFydG5lcnNbMF0uZGlzcGxheV9uYW1lXG4gIGVsc2VcbiAgcmV0dXJuIEBmaXJzdF9uYW1lX2xpc3RcblxuXG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgY29udGFpbmluZyB0ZW1wbGF0ZSBhbmQgdXNlclxuIyMgaW50ZXJhY3Rpb24gbG9naWMgZm9yIGVhY2ggb3BlbiBjaGF0IHdpbmRvdy5cbiMjIHdhdGNoZXMgYSBjb252ZXJzYXRpb24gbW9kZWwuXG5jbGFzcyBDaGF0Um9vbVxuXG4gIGNvbnN0cnVjdG9yOiAoQGNvbnZvKSAtPlxuICAgIEByZW5kZXIoKVxuICAgICQoJ2JvZHknKS5hcHBlbmQoQCRlbGVtZW50KVxuICAgICMjIGNyZWF0ZSBhbmQgYXBwZW5kIGhpZGRlbiBkaXYgZm9yIG1lc3NhZ2UgaW5wdXQgcmVzaXppbmdcbiAgICBAJG1pcnJvcl9kaXYgPSAkKFwiPGRpdiBjbGFzcz0nbWlycm9yZGl2Jz48L2Rpdj5cIilcbiAgICBAJGVsZW1lbnQuZmluZCgnc2VjdGlvbi5jb252ZXJzYXRpb24nKS5hcHBlbmQgQCRtaXJyb3JfZGl2XG4gICAgQGhpZGRlbl9kaXZfaGVpZ2h0ID0gQCRlbGVtZW50LmZpbmQoJy5taXJyb3JkaXYnKS5jc3MoJ2hlaWdodCcpXG5cbiAgICAjIyBjcmVhdGUgdmFyaWFibGUgZm9yIGZpbGV1cGxvYWQgdG8gYWRkIGFuZCByZW1vdmVcbiAgICBAJGZpbGVfdXBsb2FkID0gQCRlbGVtZW50LmZpbmQoJ2xhYmVsLmltZ191cGxvYWQnKVxuXG4gICAgQGxvYWRQZXJzaXN0ZW50TWVzc2FnZXMoKVxuICAgICMjIFdFQlNPQ0tFVCBMSVNURU5FUlMgRk9SIE1FU1NBR0UgQU5EIFRZUElORyBOT1RJRklDQVRJT05TXG4gICAgYXBwLnNlcnZlci5vbiAnbWVzc2FnZScsIEBtZXNzYWdlX2NhbGxiYWNrLmJpbmQodGhpcylcbiAgICBhcHAuc2VydmVyLm9uICd1c2VyX29mZmxpbmUnLCBAdXNlcl9vZmZsaW5lX2NhbGxiYWNrLmJpbmQodGhpcylcbiAgICBhcHAuc2VydmVyLm9uICd0eXBpbmdfbm90aWZpY2F0aW9uJywgQHR5cGluZ19ub3RpZmljYXRpb25fY2FsbGJhY2suYmluZCh0aGlzKVxuXG4gICAgIyMgTElTVEVORVJTIEZPUiBVU0VSIElOVEVSQUNUSU9OIFdJVEggQ0hBVCBXSU5ET1dcbiAgICBAJGVsZW1lbnQuZmluZCgnLmNoYXQtY2xvc2UnKS5vbiAnY2xpY2snLCBAY2xvc2VXaW5kb3cuYmluZCh0aGlzKVxuICAgIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLm9uICdrZXlwcmVzcycsIEBzZW5kT25FbnRlci5iaW5kKHRoaXMpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub24gJ2tleXVwJywgQGVtaXRUeXBpbmdOb3RpZmljYXRpb24uYmluZCh0aGlzKVxuICAgIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLm9uICdrZXl1cCcsIEBncm93X21lc3NhZ2VfZmllbGQuYmluZCh0aGlzKVxuICAgIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLm9uICdrZXl1cCcsIEB0b2dnbGVfZmlsZV91cGxvYWRfYnV0dG9uLmJpbmQodGhpcylcbiAgICBAJGVsZW1lbnQuZmluZCgnLnRvcC1iYXIsIG1pbmlmeSAnKS5vbiAnY2xpY2snLCBAdG9nZ2xlQ2hhdC5iaW5kKHRoaXMpXG4gICAgQCRlbGVtZW50Lm9uICdjbGljaycsIEByZW1vdmVOb3RpZmljYXRpb25zLmJpbmQodGhpcylcbiAgICBAJGZpbGVfdXBsb2FkLm9uICdjaGFuZ2UnLCBAZmlsZV91cGxvYWQuYmluZCh0aGlzKVxuICAgIGFwcC50aXRsZV9ub3RpZmljYXRpb24gPVxuICAgICAgICAgICAgICAgICAgICAgICAgbm90aWZpZWQ6IGZhbHNlXG4gICAgICAgICAgICAgICAgICAgICAgICBwYWdlX3RpdGxlOiAkKCdodG1sIHRpdGxlJykuaHRtbCgpXG4gIG1lc3NhZ2VfY2FsbGJhY2s6IChtZXNzYWdlKSAtPlxuICAgIGlmIEBjb252by5tZXNzYWdlX2ZpbHRlciBpcyBtZXNzYWdlLmNvbnZvX2lkXG4gICAgICBuZXdfbWVzc2FnZSA9IG5ldyBNZXNzYWdlKG1lc3NhZ2UucmVjaXBpZW50cywgbWVzc2FnZS5zZW5kZXIsIG1lc3NhZ2UuY29udGVudCwgbWVzc2FnZS5pbWFnZSwgbWVzc2FnZS50aW1lX3N0YW1wKVxuICAgICAgQGNvbnZvLmFkZF9tZXNzYWdlKG5ld19tZXNzYWdlKVxuICAgICAgQHJlbmRlckRpc2N1c3Npb24oKVxuICAgICAgQCRlbGVtZW50LmZpbmQoJy50b3AtYmFyJykuYWRkQ2xhc3MoJ25ldy1tZXNzYWdlJylcbiAgICAgIEB0aXRsZUFsZXJ0KClcblxuICB1c2VyX29mZmxpbmVfY2FsbGJhY2s6IC0+XG4gICAgbWVzc2FnZSA9IG5ldyBNZXNzYWdlKCBhcHAubWUsIHtpbWFnZV91cmw6J2h0dHA6Ly9zdG9yYWdlLmdvb2dsZWFwaXMuY29tL3BhcmxleS1hc3NldHMvc2VydmVyX25ldHdvcmsucG5nJ30sIFwiVGhpcyB1c2VyIGlzIG5vIGxvbmdlciBvbmxpbmVcIiwgZmFsc2UsIG5ldyBEYXRlKCkgKVxuICAgIEBjb252by5hZGRfbWVzc2FnZShtZXNzYWdlKVxuICAgIEByZW5kZXJEaXNjdXNzaW9uKClcblxuICB0eXBpbmdfbm90aWZpY2F0aW9uX2NhbGxiYWNrOiAoY29udm9faWQsIHR5cGlzdCwgYm9vbCkgLT5cbiAgICBpZiBjb252b19pZCBpcyBAY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgIGlmIGJvb2xcbiAgICAgICAgaWYgQCRkaXNjdXNzaW9uLmZpbmQoJy5pbmNvbWluZycpLmxlbmd0aCBpcyAwXG4gICAgICAgICAgdHlwaW5nX25vdGlmaWNhdGlvbiA9IFwiPGxpIGNsYXNzPSdpbmNvbWluZyc+PGRpdiBjbGFzcz0nYXZhdGFyJz48aW1nIHNyYz0nI3t0eXBpc3QuaW1hZ2VfdXJsfScvPjwvZGl2PjxkaXYgY2xhc3M9J21lc3NhZ2VzJz48cD4je3R5cGlzdC5kaXNwbGF5X25hbWV9IGlzIHR5cGluZy4uLjwvcD48L2Rpdj48L2xpPlwiXG4gICAgICAgICAgQCRkaXNjdXNzaW9uLmFwcGVuZCh0eXBpbmdfbm90aWZpY2F0aW9uKVxuICAgICAgICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlKClcbiAgICAgIGVsc2VcbiAgICAgICAgQCRkaXNjdXNzaW9uLmZpbmQoJy5pbmNvbWluZycpLnJlbW92ZSgpXG4gICAgICAgIEBzY3JvbGxUb0xhc3RNZXNzYWdlKClcblxuXG4gIGFkZF9tZW1iZXI6IChuZXdfdXNlcikgLT5cbiAgICAjIyBjcmVhdGUgYSBjb252ZXJzYXRpb24gY29uc2lzdGluZyBvZiBjdXJyZW50IHBsdXMgYWRkZWQgbWVtYmVyc1xuICAgIG5ld19jb252b19wYXJ0bmVycyA9IEBjb252by5jb252b19wYXJ0bmVycy5jb25jYXQobmV3X3VzZXIpXG4gICAgbmV3X2NvbnZvX2dyb3VwID0gbmV3IENvbnZlcnNhdGlvbihuZXdfY29udm9fcGFydG5lcnMpXG4gICAgYXBwLmNvbnZlcnNhdGlvbnMucHVzaChuZXdfY29udm9fZ3JvdXApXG5cbiAgICAjIyByZW1vdmUgY3VycmVudCBjb252b19rZXkgZnJvbSBhcHAub3Blbl9jb252ZXJzYXRpb25zXG4gICAgZm9yIG9wZW5fY29udm8gaW4gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgICAgaWYgb3Blbl9jb252byBpcyBAY29udm8ubWVzc2FnZV9maWx0ZXJcbiAgICAgICAgYXBwLm9wZW5fY29udmVyc2F0aW9ucy5zcGxpY2UoaSwxKVxuXG4gICAgIyMgcHVzaCBuZXcgY29udm8gdG8gb3BlbiBjb252ZXJzYXRpb25zLCBjaGFuZ2UgQGNvbnZvIGFuZCByZS1yZW5kZXJcbiAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2gobmV3X2NvbnZvX2dyb3VwLm1lc3NhZ2VfZmlsdGVyKVxuICAgIEBjb252byA9IG5ld19jb252b19ncm91cFxuICAgIEByZW5kZXIoKVxuXG4gIHJlbmRlcjogLT5cbiAgICBAJGVsZW1lbnQgPSAkKGNoYXRfcm9vbV90ZW1wbGF0ZShAY29udm8pKVxuICAgIEAkZGlzY3Vzc2lvbiA9IEAkZWxlbWVudC5maW5kKCcuZGlzY3Vzc2lvbicpXG5cbiAgcmVuZGVyRGlzY3Vzc2lvbjogLT5cbiAgICBuZXdfbWVzc2FnZSA9IEBjb252by5tZXNzYWdlcy5zbGljZSgtMSlbMF1cbiAgICBAYXBwZW5kTWVzc2FnZShuZXdfbWVzc2FnZSlcbiAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZSgpXG5cbiAgYXBwZW5kTWVzc2FnZTogKG1lc3NhZ2UpLT5cbiAgICBtZXNzYWdlX3ZpZXcgPSBuZXcgTWVzc2FnZVZpZXcobWVzc2FnZSlcbiAgICBtZXNzYWdlX3ZpZXcucmVuZGVyKClcbiAgICBAJGRpc2N1c3Npb24uYXBwZW5kKG1lc3NhZ2Vfdmlldy4kZWxlbWVudClcblxuICBzY3JvbGxUb0xhc3RNZXNzYWdlOiAtPlxuICAgIEAkZGlzY3Vzc2lvbi5zY3JvbGxUb3AoIEAkZGlzY3Vzc2lvbi5maW5kKCdsaTpsYXN0LWNoaWxkJykub2Zmc2V0KCkudG9wICsgQCRkaXNjdXNzaW9uLnNjcm9sbFRvcCgpIClcblxuICBsb2FkUGVyc2lzdGVudE1lc3NhZ2VzOiAtPlxuICAgIGZvciBtZXNzYWdlIGluIEBjb252by5tZXNzYWdlc1xuICAgICAgQGFwcGVuZE1lc3NhZ2UobWVzc2FnZSlcbiAgICBpZiBAY29udm8ubWVzc2FnZXMubGVuZ3RoID4gMFxuICAgICAgQHNjcm9sbFRvTGFzdE1lc3NhZ2UoKVxuXG4gIHNlbmRPbkVudGVyOiAoZSktPlxuICAgIGlmIGUua2V5Q29kZSBpcyAxM1xuICAgICAgQHNlbmRNZXNzYWdlKClcbiAgICAgIEByZW1vdmVOb3RpZmljYXRpb25zKClcblxuICBzZW5kTWVzc2FnZTogLT5cbiAgICBtZXNzYWdlID0gbmV3IE1lc3NhZ2UgQGNvbnZvLmNvbnZvX3BhcnRuZXJzLCBhcHAubWUsIEAkZWxlbWVudC5maW5kKCcuc2VuZCcpLnZhbCgpXG4gICAgQGNvbnZvLmFkZF9tZXNzYWdlKG1lc3NhZ2UpXG4gICAgQHJlbmRlckRpc2N1c3Npb24oKVxuICAgIGFwcC5zZXJ2ZXIuZW1pdCAnbWVzc2FnZScsIG1lc3NhZ2VcbiAgICBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS52YWwoJycpXG4gICAgQGVtaXRUeXBpbmdOb3RpZmljYXRpb24oKVxuXG4gIHRvZ2dsZUNoYXQ6IChlKSAtPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgIEAkZGlzY3Vzc2lvbi50b2dnbGUoKVxuICAgIGlmIEAkZGlzY3Vzc2lvbi5hdHRyKCdkaXNwbGF5JykgaXMgbm90IFwibm9uZVwiXG4gICAgICBAc2Nyb2xsVG9MYXN0TWVzc2FnZVxuXG4gIGNsb3NlV2luZG93OiAoZSkgLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpXG4gICAgIyMgcmVtb3ZlIGZyb20gb3BlbiBjb252b3NcbiAgICBmb3Igb3Blbl9jb252bywgaSBpbiBhcHAub3Blbl9jb252ZXJzYXRpb25zXG4gICAgICBpZiBvcGVuX2NvbnZvIGlzIEBjb252by5tZXNzYWdlX2ZpbHRlclxuICAgICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnNwbGljZShpLDEpXG5cbiAgICAjIyByZW1vdmUgYWxsIHdlYnNvY2tldCBsaXN0ZW5lcnMgZm9yIGdhcmJhZ2UgY29sbGVjdGlvblxuICAgICMjIHJlbW92ZSBjaGF0IGZyb20gRE9NXG4gICAgYXBwLnNlcnZlci5yZW1vdmVMaXN0ZW5lciAnbWVzc2FnZScsIEBtZXNzYWdlX2NhbGxiYWNrLmJpbmQodGhpcylcbiAgICBhcHAuc2VydmVyLnJlbW92ZUxpc3RlbmVyICd1c2VyX29mZmxpbmUnLCBAdXNlcl9vZmZsaW5lX2NhbGxiYWNrLmJpbmQodGhpcylcbiAgICBhcHAuc2VydmVyLnJlbW92ZUxpc3RlbmVyICd0eXBpbmdfbm90aWZpY2F0aW9uJywgQHR5cGluZ19ub3RpZmljYXRpb25fY2FsbGJhY2suYmluZCh0aGlzKVxuICAgIEAkZWxlbWVudC5maW5kKCcuY2hhdC1jbG9zZScpLm9mZigpXG4gICAgQCRlbGVtZW50LmZpbmQoJy5zZW5kJykub2ZmKClcbiAgICBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS5vZmYoKVxuICAgIEAkZWxlbWVudC5maW5kKCcudG9wLWJhcicpLm9mZigpXG4gICAgQCRlbGVtZW50Lm9mZigpXG4gICAgQCRkaXNjdXNzaW9uLm9mZigpXG4gICAgQCRlbGVtZW50LnJlbW92ZSgpXG4gICAgZGVsZXRlIHRoaXNcblxuICByZW1vdmVOb3RpZmljYXRpb25zOiAoZSkgLT5cbiAgICBAJGVsZW1lbnQuZmluZCgnLnRvcC1iYXInKS5yZW1vdmVDbGFzcygnbmV3LW1lc3NhZ2UnKVxuICAgIGlmIGFwcC50aXRsZV9ub3RpZmljYXRpb24ubm90aWZpZWRcbiAgICAgIEBjbGVhclRpdGxlTm90aWZpY2F0aW9uKClcblxuICBlbWl0VHlwaW5nTm90aWZpY2F0aW9uOiAoZSkgLT5cbiAgICBpZiBAJGVsZW1lbnQuZmluZCgnLnNlbmQnKS52YWwoKSBpc250IFwiXCJcbiAgICAgIGFwcC5zZXJ2ZXIuZW1pdCAndXNlcl90eXBpbmcnLCBAY29udm8uY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscywgYXBwLm1lLCB0cnVlXG4gICAgZWxzZVxuICAgICAgYXBwLnNlcnZlci5lbWl0ICd1c2VyX3R5cGluZycsIEBjb252by5jb252b19wYXJ0bmVyc19pbWFnZV91cmxzLCBhcHAubWUsIGZhbHNlXG5cbiAgY2xlYXJUaXRsZU5vdGlmaWNhdGlvbjogLT5cbiAgICBhcHAuY2xlYXJBbGVydCgpXG4gICAgJCgnaHRtbCB0aXRsZScpLmh0bWwoIGFwcC50aXRsZV9ub3RpZmljYXRpb24ucGFnZV90aXRsZSApXG4gICAgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5ub3RpZmllZCA9IGZhbHNlXG5cbiAgdGl0bGVBbGVydDogLT5cbiAgICBpZiBub3QgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5ub3RpZmllZFxuICAgICAgc2VuZGVyX25hbWUgPSBAY29udm8ubWVzc2FnZXNbQGNvbnZvLm1lc3NhZ2VzLmxlbmd0aCAtIDFdLnNlbmRlci5kaXNwbGF5X25hbWVcbiAgICAgIGFsZXJ0ID0gXCJQZW5kaW5nICoqICN7c2VuZGVyX25hbWV9XCJcblxuICAgICAgc2V0QWxlcnQgPSAtPlxuICAgICAgICBpZiAkKCdodG1sIHRpdGxlJykuaHRtbCgpIGlzIGFwcC50aXRsZV9ub3RpZmljYXRpb24ucGFnZV90aXRsZVxuICAgICAgICAgICQoJ2h0bWwgdGl0bGUnKS5odG1sKGFsZXJ0KVxuICAgICAgICBlbHNlXG4gICAgICAgICAgJCgnaHRtbCB0aXRsZScpLmh0bWwoIGFwcC50aXRsZV9ub3RpZmljYXRpb24ucGFnZV90aXRsZSlcblxuICAgICAgdGl0bGVfYWxlcnQgPSBzZXRJbnRlcnZhbChzZXRBbGVydCwgMjIwMClcblxuICAgICAgYXBwLmNsZWFyX2FsZXJ0ID0gLT5cbiAgICAgICAgY2xlYXJJbnRlcnZhbCh0aXRsZV9hbGVydClcblxuICAgICAgYXBwLnRpdGxlX25vdGlmaWNhdGlvbi5ub3RpZmllZCA9IHRydWVcblxuICBmaWxlX3VwbG9hZDogLT5cbiAgICBmaWxlID0gQCRlbGVtZW50LmZpbmQoJy5wYXJsZXlfZmlsZV91cGxvYWQnKS5nZXQoMCkuZmlsZXNbMF1cbiAgICBhcHAub2F1dGguZmlsZV91cGxvYWQgZmlsZSwgQGNvbnZvLmNvbnZvX3BhcnRuZXJzLCBAY29udm8ubWVzc2FnZV9maWx0ZXJcblxuICBncm93X21lc3NhZ2VfZmllbGQ6IC0+XG4gICAgJHR4dCA9IEAkZWxlbWVudC5maW5kKCd0ZXh0YXJlYS5zZW5kJylcbiAgICBjb250ZW50ID0gJHR4dC52YWwoKVxuICAgIGFkanVzdGVkX2NvbnRlbnQgPSBjb250ZW50LnJlcGxhY2UoL1xcbi9nLCBcIjxicj5cIilcbiAgICBAJG1pcnJvcl9kaXYuaHRtbChhZGp1c3RlZF9jb250ZW50KVxuICAgIEBoaWRkZW5fZGl2X2hlaWdodCA9IEAkbWlycm9yX2Rpdi5jc3MoJ2hlaWdodCcpXG4gICAgaWYgQGhpZGRlbl9kaXZfaGVpZ2h0IGlzbnQgJHR4dC5jc3MoJ2hlaWdodCcpXG4gICAgICAkdHh0LmNzcygnaGVpZ2h0JywgQGhpZGRlbl9kaXZfaGVpZ2h0KVxuXG5cbiAgdG9nZ2xlX2ZpbGVfdXBsb2FkX2J1dHRvbjogLT5cbiAgICAjIyByZW1vdmUgaWNvbiBmb3IgZmlsZSB1cGxvYWRcbiAgICBpZiBAJGVsZW1lbnQuZmluZCgndGV4dGFyZWEuc2VuZCcpLnZhbCgpIGlzbnQgXCJcIlxuICAgICAgaWYgQCRlbGVtZW50LmZpbmQoJ2xhYmVsLmltZ191cGxvYWQnKS5sZW5ndGggaXMgMVxuICAgICAgICBAJGVsZW1lbnQuZmluZCgnbGFiZWwuaW1nX3VwbG9hZCcpLnJlbW92ZSgpXG4gICAgZWxzZVxuICAgICAgaWYgQCRlbGVtZW50LmZpbmQoJ2xhYmVsLmltZ191cGxvYWQnKS5sZW5ndGggaXMgMFxuICAgICAgICBAJGVsZW1lbnQuZmluZCgnc2VjdGlvbi5jb252ZXJzYXRpb24nKS5hcHBlbmQoQCRmaWxlX3VwbG9hZClcbiAgICAgICAgQCRmaWxlX3VwbG9hZC5vbiAnY2hhbmdlJywgQGZpbGVfdXBsb2FkLmJpbmQodGhpcylcblxuXG5cblxubW9kdWxlLmV4cG9ydHMgPSBDaGF0Um9vbVxuIiwiYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcblVzZXJWaWV3ID0gcmVxdWlyZSgnLi91c2VyX3ZpZXcuY29mZmVlJylcblBlcnNpc3RlbnRDb252ZXJzYXRpb25WaWV3ID0gcmVxdWlyZSgnLi9wZXJzaXN0ZW50X2NvbnZlcnNhdGlvbl92aWV3LmNvZmZlZScpXG5sb2dnZWRfb3V0X3RlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZXMvbG9nZ2VkX291dC5oYnMnKVxubG9nZ2VkX2luX3RlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZXMvbG9nZ2VkX2luLmhicycpXG5wcm9maWxlX3RlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZXMvcHJvZmlsZS5oYnMnKVxuQ29udmVyc2F0aW9uID0gcmVxdWlyZSgnLi9jb252ZXJzYXRpb25fbW9kZWwuY29mZmVlJylcbkNoYXRSb29tID0gcmVxdWlyZSgnLi9jaGF0X3Jvb21fdmlldy5jb2ZmZWUnKVxuXG5cblxuIyBDb250cm9sIFBhbmVsIGZvciBQYXJsZXkuanNcbiMgVGhpcyBpcyB0aGUgb25seSB2aWV3IHRoYXQgY2Fubm90IGJlIHJlbW92ZWQuXG4jIEl0IGlzIHRoZSBodWIgZm9yIGFsbCBpbnRlcmFjdGlvbi5cbmNsYXNzIENvbW1hbmRDZW50ZXJcbiAgY29uc3RydWN0b3I6IC0+XG4gICAgQG1lbnUgPSBcImRlZmF1bHRcIlxuICAgIEAkYWRkX3VzZXJfYmFyID0gJCgnPGRpdiBjbGFzcz1cImFkZC11c2VyLWJhclwiPjxhIGNsYXNzPVwiY2FuY2VsXCI+Q2FuY2VsPC9hPjxhIGNsYXNzPVwiY29uZmlybSBkaXNhYmxlZFwiPkFkZCBQZW9wbGU8L2E+XG4gICAgICAgIDwvZGl2PicpXG4gICAgQG5ld19jb252b19wYXJhbXMgPSBbXVxuICAgICQoJ2JvZHknKS5hcHBlbmQgbG9nZ2VkX291dF90ZW1wbGF0ZSgpXG4gICAgJChcInVsLmxvZ2luLWJhclwiKS5oaWRlKClcbiAgICAkKCcucGFybGV5IC5wZXJzaXN0ZW50LWJhci5sb2dnZWQtb3V0Jykub24gJ2NsaWNrJywgKGUpIC0+ICQoJ3VsLmxvZ2luLWJhcicpLnRvZ2dsZSgpXG5cbiAgbG9nX2luOiAtPlxuICAgIEBsb2dnZWRfaW4gPSB0cnVlXG4gICAgJChcIi5wYXJsZXkgLnBlcnNpc3RlbnQtYmFyLmxvZ2dlZF9vdXRcIikub2ZmKClcbiAgICBAJGVsZW1lbnQgPSAkKGxvZ2dlZF9pbl90ZW1wbGF0ZShhcHAubWUpKVxuICAgICQoJy5wYXJsZXkgc2VjdGlvbi5jb250cm9sbGVyJykuaHRtbChAJGVsZW1lbnQpXG4gICAgJCgnLnBlcnNpc3RlbnQtYmFyJykub24gJ2NsaWNrJywgQHRvZ2dsZV9jb21tYW5kX2NlbnRlci5iaW5kKHRoaXMpXG4gICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci1iYXIgYS5tZXNzYWdlcycpLm9uICdjbGljaycsIEB0b2dnbGVfcGVyc2lzdGVudF9jb252b3MuYmluZCh0aGlzKVxuICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItYmFyIGEuYWN0aXZlLXVzZXJzJykub24gJ2NsaWNrJywgQHRvZ2dsZV9jdXJyZW50X3VzZXJzLmJpbmQodGhpcylcbiAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLWJhciBhLnVzZXItc2V0dGluZ3MnKS5vbiAnY2xpY2snLCBAdG9nZ2xlX3VzZXJfc2V0dGluZ3MuYmluZCh0aGlzKVxuXG4gIHRvZ2dsZV9jb21tYW5kX2NlbnRlcjogKGUpLT5cbiAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAkKCcuY29udHJvbGxlci12aWV3JykudG9nZ2xlKClcbiAgICBpZiAkKCdkaXYucGVyc2lzdGVudC1iYXIgc3BhbicpLmhhc0NsYXNzKCdlbnR5cG8tZG93bi1vcGVuLW1pbmknKVxuICAgICAgJCgnZGl2LnBlcnNpc3RlbnQtYmFyIHNwYW4nKS5yZW1vdmVDbGFzcygnZW50eXBvLWRvd24tb3Blbi1taW5pJylcbiAgICAgIC5hZGRDbGFzcygnZW50eXBvLXVwLW9wZW4tbWluaScpXG4gICAgZWxzZVxuICAgICAgJCgnZGl2LnBlcnNpc3RlbnQtYmFyIHNwYW4nKS5yZW1vdmVDbGFzcygnZW50eXBvLXVwLW9wZW4tbWluaScpXG4gICAgICAuYWRkQ2xhc3MoJ2VudHlwby1kb3duLW9wZW4tbWluaScpXG5cblxuXG4gIHRvZ2dsZV9jdXJyZW50X3VzZXJzOiAoZSktPlxuICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmNoaWxkcmVuKCkucmVtb3ZlKClcbiAgICBpZiBAbWVudSBpc250IFwiY3VycmVudF91c2Vyc1wiXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5hcHBlbmQoJzxsaT48aDE+U3RhcnQgQ29udmVyc2F0aW9uPC9oMT48L2xpPicpXG4gICAgICBmb3IgdXNlciBpbiBhcHAuY3VycmVudF91c2Vyc1xuICAgICAgICB2aWV3ID0gbmV3IFVzZXJWaWV3KHVzZXIsIHRoaXMpXG4gICAgICAgIHZpZXcucmVuZGVyKClcbiAgICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuYXBwZW5kKHZpZXcuJGVsZW1lbnQpXG4gICAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5hcHBlbmQoQCRhZGRfdXNlcl9iYXIpXG4gICAgICBAJGVsZW1lbnQuZmluZCgnLmNhbmNlbCcpLm9uICdjbGljaycsIEByZWZyZXNoX2NvbnZvX2NyZWF0aW9uLmJpbmQodGhpcylcbiAgICAgIEBtZW51ID0gXCJjdXJyZW50X3VzZXJzXCJcbiAgICBlbHNlXG4gICAgICBAbWVudSA9IG51bGxcblxuICB0b2dnbGVfcGVyc2lzdGVudF9jb252b3M6IChlKS0+XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgJChcIi5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlld1wiKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgaWYgQG1lbnUgaXNudCBcInBlcnNpc3RlbnRfY29udm9zXCJcbiAgICAgIGZvciBjb252byBpbiBhcHAuY29udmVyc2F0aW9uc1xuICAgICAgICBpZiBjb252by5tZXNzYWdlcy5sZW5ndGggPiAwXG4gICAgICAgICAgdmlldyA9IG5ldyBQZXJzaXN0ZW50Q29udmVyc2F0aW9uVmlldyhjb252bylcbiAgICAgICAgICB2aWV3LnJlbmRlcigpXG4gICAgICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuYXBwZW5kKHZpZXcuJGVsZW1lbnQpXG4gICAgICBAbWVudSA9IFwicGVyc2lzdGVudF9jb252b3NcIlxuICAgIGVsc2VcbiAgICAgIEBtZW51ID0gbnVsbFxuXG5cblxuXG4gIHRvZ2dsZV91c2VyX3NldHRpbmdzOiAoZSktPlxuICAgIGUucHJldmVudERlZmF1bHRcbiAgICAkKCcucGFybGV5IGRpdi5jb250cm9sbGVyLXZpZXcnKS5jaGlsZHJlbigpLnJlbW92ZSgpXG4gICAgaWYgQG1lbnUgaXNudCBcInVzZXJfc2V0dGluZ3NcIlxuICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuaHRtbChwcm9maWxlX3RlbXBsYXRlKGFwcC5tZSkpXG4gICAgICBAbWVudSA9IFwidXNlcl9zZXR0aW5nc1wiXG4gICAgZWxzZVxuICAgICAgQG1lbnUgPSBudWxsXG5cbiAgY29uZmlybV9uZXdfY29udm9fcGFyYW1zOiAoZSkgLT5cbiAgICBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzID0gW11cbiAgICBmb3IgdXNlciBpbiBAbmV3X2NvbnZvX3BhcmFtc1xuICAgICAgY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscy5wdXNoKHVzZXIuaW1hZ2VfdXJsKVxuICAgIGNvbnZvX2lkID0gY29udm9fcGFydG5lcnNfaW1hZ2VfdXJscy5jb25jYXQoYXBwLm1lLmltYWdlX3VybCkuc29ydCgpLmpvaW4oKVxuICAgICMjIGNoZWNrIHRvIG1ha2Ugc3VyZSBjb252byBpc24ndCBhbHJlYWR5IG9wZW5cbiAgICBmb3IgY29udm8gaW4gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgICAgaWYgY29udm9faWQgaXMgY29udm9cbiAgICAgICAgcmV0dXJuXG4gICAgIyMgY2hlY2sgdG8gc2VlIGlmIHBlcnNpc3RlbnQgY29udm8gZXhpc3RzIHdpdGggdGhlIGdyb3VwXG4gICAgY29udm9fZXhpc3RzID0gZmFsc2VcbiAgICBmb3IgY29udm8gaW4gYXBwLmNvbnZlcnNhdGlvbnNcbiAgICAgIGlmIGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIGNvbnZvX2lkXG4gICAgICAgIGNvbnZvX2V4aXN0cyA9IHRydWVcbiAgICAgICAgY29udm8gPSBjb252b1xuICAgIGlmIGNvbnZvX2V4aXN0c1xuICAgICAgY2hhdF93aW5kb3cgPSBuZXcgQ2hhdFJvb20oY29udm8pXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG4gICAgICBAbmV3X2NvbnZvX3BhcmFtcyA9IFtdXG4gICAgICBAcmVmcmVzaF9jb252b19jcmVhdGlvbigpXG4gICAgZWxzZVxuICAgICAgIyMgY3JlYXRlIG5ldyBjb252ZXJzYXRpb24gd2l0aCBzZWxlY3RlZCBncm91cCBtZW1iZXJzXG4gICAgICBjb252ZXJzYXRpb24gPSBuZXcgQ29udmVyc2F0aW9uKEBuZXdfY29udm9fcGFyYW1zKVxuICAgICAgY2hhdF93aW5kb3cgPSBuZXcgQ2hhdFJvb20oY29udmVyc2F0aW9uKVxuICAgICAgYXBwLmNvbnZlcnNhdGlvbnMucHVzaChjb252ZXJzYXRpb24pXG4gICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG4gICAgICBAbmV3X2NvbnZvX3BhcmFtcyA9IFtdXG4gICAgICBAcmVmcmVzaF9jb252b19jcmVhdGlvbigpXG5cbiAgcmVmcmVzaF9jb252b19jcmVhdGlvbjogKGUpIC0+XG4gICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuY2hpbGRyZW4oKS5yZW1vdmUoKVxuICAgICQoJy5wYXJsZXkgZGl2LmNvbnRyb2xsZXItdmlldycpLmFwcGVuZCgnPGxpPjxoMT5TdGFydCBDb252ZXJzYXRpb248L2gxPjwvbGk+JylcbiAgICBmb3IgdXNlciBpbiBhcHAuY3VycmVudF91c2Vyc1xuICAgICAgQG5ld19jb252b19wYXJhbXMgPSBbXVxuICAgICAgdmlldyA9IG5ldyBVc2VyVmlldyh1c2VyLCB0aGlzKVxuICAgICAgdmlldy5yZW5kZXIoKVxuICAgICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuYXBwZW5kKHZpZXcuJGVsZW1lbnQpXG4gICAgJCgnLnBhcmxleSBkaXYuY29udHJvbGxlci12aWV3JykuYXBwZW5kKEAkYWRkX3VzZXJfYmFyKVxuICAgIEAkZWxlbWVudC5maW5kKCcuY2FuY2VsJykub24gJ2NsaWNrJywgQHJlZnJlc2hfY29udm9fY3JlYXRpb24uYmluZCh0aGlzKVxuXG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IENvbW1hbmRDZW50ZXIoKVxuXG4iLCJhcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuXG4jIyBjb25zdHJ1Y3RvciBmb3IgY29udmVyc2F0aW9ucyBvYmplY3RzIHRoYXQgcmVwcmVzZW50IGFsbCByZWxldmFudFxuIyMgZGF0YSBhbmQgbG9naWMgcGVydGFpbmluZyB0byBtYW5hZ2luZyBhIGNvbnZlcnNhdGlvblxuIyMgaW5jbHVkaW5nIGEgY29sbGVjdGlvbiBvZiBtZXNzYWdlIG9iamVjdHMuXG5jbGFzcyBDb252ZXJzYXRpb25cblxuICBjb25zdHJ1Y3RvcjogKEBjb252b19wYXJ0bmVycywgQG1lc3NhZ2VzPVtdKSAtPlxuICAgIEBnZW5lcmF0ZV9tZXNzYWdlX2ZpbHRlcigpXG4gICAgY29uc29sZS5sb2coQG1lc3NhZ2VfZmlsdGVyKVxuICAgIEBmaXJzdF9uYW1lX2xpc3QgPSBcIlwiXG4gICAgQGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMgPSBbXVxuXG4gICAgZm9yIHVzZXIsIGkgaW4gQGNvbnZvX3BhcnRuZXJzXG4gICAgICBmaXJzdF9uYW1lID0gdXNlci5kaXNwbGF5X25hbWUubWF0Y2goL15bQS16XSsvKVxuICAgICAgaWYgKGkgKyAxKSBpc250IEBjb252b19wYXJ0bmVycy5sZW5ndGhcbiAgICAgICAgQGZpcnN0X25hbWVfbGlzdCArPSBcIiN7Zmlyc3RfbmFtZX0sIFwiXG4gICAgICAgIEBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzLnB1c2godXNlci5pbWFnZV91cmwpXG4gICAgICBlbHNlXG4gICAgICAgIEBmaXJzdF9uYW1lX2xpc3QgKz0gXCIje2ZpcnN0X25hbWV9XCJcbiAgICAgICAgQGNvbnZvX3BhcnRuZXJzX2ltYWdlX3VybHMucHVzaCh1c2VyLmltYWdlX3VybClcblxuICBhZGRfbWVzc2FnZTogKG1lc3NhZ2UpIC0+XG4gICAgQG1lc3NhZ2VzLnB1c2ggbWVzc2FnZVxuXG4gIGdlbmVyYXRlX21lc3NhZ2VfZmlsdGVyOiAtPlxuICAgIEBtZXNzYWdlX2ZpbHRlciA9IFthcHAubWUuaW1hZ2VfdXJsXVxuICAgIGZvciBwYXJ0bmVyIGluIEBjb252b19wYXJ0bmVyc1xuICAgICAgQG1lc3NhZ2VfZmlsdGVyLnB1c2ggcGFydG5lci5pbWFnZV91cmxcbiAgICBAbWVzc2FnZV9maWx0ZXIgPSBAbWVzc2FnZV9maWx0ZXIuc29ydCgpLmpvaW4oKVxuXG5tb2R1bGUuZXhwb3J0cyA9IENvbnZlcnNhdGlvblxuIiwiYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcblxuIyMgY29uc3RydWN0b3IgZm9yIG9iamVjdCB0aGF0IGNvbnRhaW5zIGFsbCBsb2dpYyBhbmQgZGF0YVxuIyMgYXNzb2NpYXRlZCB3aXRoIGluZGl2aWR1YWwgbWVzc2FnZXNcblxuY2xhc3MgTWVzc2FnZVxuXG4gIGNvbnN0cnVjdG9yOiAoQHJlY2lwaWVudHMsIEBzZW5kZXIsIEBjb250ZW50LCBAaW1hZ2U9ZmFsc2UsIEB0aW1lX3N0YW1wKSAtPlxuICAgIGlmIG5vdCBAdGltZV9zdGFtcFxuICAgICAgQHRpbWVfc3RhbXAgPSBuZXcgRGF0ZSgpLnRvVVRDU3RyaW5nKClcbiAgICBpZF9hcnJheSA9IFtdXG4gICAgZm9yIHVzZXIgaW4gQHJlY2lwaWVudHNcbiAgICAgIGlkX2FycmF5ID0gaWRfYXJyYXkuY29uY2F0KHVzZXIuaW1hZ2VfdXJsKVxuICAgIGlkX2FycmF5ID0gaWRfYXJyYXkuY29uY2F0KEBzZW5kZXIuaW1hZ2VfdXJsKVxuICAgIEBjb252b19pZCA9IGlkX2FycmF5LnNvcnQoKS5qb2luKClcbiAgICBAdGltZV9jcmVhdGVkID0gbmV3IERhdGUoQHRpbWVfc3RhbXApXG4gICAgQHRpbWVfc2luY2VfY3JlYXRlZCA9IEBjYWxjdWxhdGVfdGltZSgpXG5cbiAgY2FsY3VsYXRlX3RpbWU6IC0+XG4gICAgY3VycmVudF90aW1lID0gbmV3IERhdGUoKVxuICAgICMjIENvbnZlcnQgdG8gbWludXRlc1xuICAgIG1pbnV0ZXMgPSBNYXRoLmZsb29yKChjdXJyZW50X3RpbWUgLSBAdGltZV9jcmVhdGVkKSAvIDYwMDAwIClcbiAgICAjIyBkZXRlcm1pbmUgaWYgdG9kYXlcbiAgICBpZiBjdXJyZW50X3RpbWUuZ2V0RGF0ZSgpIGlzIEB0aW1lX2NyZWF0ZWQuZ2V0RGF0ZSgpIGFuZCBtaW51dGVzIDwgMTQ0MFxuICAgICAgdG9kYXkgPSB0cnVlXG4gICAgIyMgQ29udmVydCB0byBob3Vyc1xuICAgIGhvdXJzID0gTWF0aC5mbG9vcigobWludXRlcyAvIDYwICkpXG4gICAgbWludXRlX3JlbWFpbmRlciA9IE1hdGguZmxvb3IoKG1pbnV0ZXMgJSA2MCApKVxuICAgICMjIGZvcm1hdCBtZXNzYWdlXG4gICAgaWYgbWludXRlcyA8IDYwXG4gICAgICByZXR1cm4gXCIje21pbnV0ZXN9IG1pbnMgYWdvXCJcbiAgICBpZiBob3VycyA8IDRcbiAgICAgIGlmIG1pbnV0ZV9yZW1haW5kZXIgaXMgMFxuICAgICAgICByZXR1cm4gXCIje2hvdXJzfSBob3VycyBhZ29cIlxuICAgICAgZWxzZVxuICAgICAgICByZXR1cm4gXCIje2hvdXJzfSBob3VyICN7bWludXRlX3JlbWFpbmRlcn0gbWluIGFnb1wiXG4gICAgZWxzZVxuICAgICAgIyMgbG9uZyB0ZXJtIG1lc3NhZ2UgZm9ybWF0XG4gICAgICBmX2RhdGUgPSBAZGF0ZV9mb3JtYXR0ZXIoKVxuICAgICAgaWYgdG9kYXlcbiAgICAgICAgcmV0dXJuIFwiI3tmX2RhdGUuaG91cn06I3tmX2RhdGUubWludXRlc30gI3tmX2RhdGUuc3VmZml4fVwiXG4gICAgICBlbHNlXG4gICAgICAgIHJldHVybiBcIiN7Zl9kYXRlLm1vbnRofSAje2ZfZGF0ZS5kYXl9IHwgI3tmX2RhdGUuaG91cn06I3tmX2RhdGUubWludXRlc30gI3tmX2RhdGUuc3VmZml4fVwiXG5cbiAgZGF0ZV9mb3JtYXR0ZXI6IC0+XG4gICAgIyMgZm9ybWF0cyBkYXRlIGZvciBAdGltZV9lbGFwc2VkIGZ1bmN0aW9uXG5cbiAgICBzd2l0Y2ggQHRpbWVfY3JlYXRlZC5nZXRNb250aCgpXG4gICAgICB3aGVuIDAgdGhlbiBuZXdfbW9udGggPSBcIkphblwiXG4gICAgICB3aGVuIDEgdGhlbiBuZXdfbW9udGggPSBcIkZlYlwiXG4gICAgICB3aGVuIDIgdGhlbiBuZXdfbW9udGggPSBcIk1hclwiXG4gICAgICB3aGVuIDMgdGhlbiBuZXdfbW9udGggPSBcIkFwclwiXG4gICAgICB3aGVuIDQgdGhlbiBuZXdfbW9udGggPSBcIk1heVwiXG4gICAgICB3aGVuIDUgdGhlbiBuZXdfbW9udGggPSBcIkp1blwiXG4gICAgICB3aGVuIDYgdGhlbiBuZXdfbW9udGggPSBcIkp1bFwiXG4gICAgICB3aGVuIDcgdGhlbiBuZXdfbW9udGggPSBcIkF1Z1wiXG4gICAgICB3aGVuIDggdGhlbiBuZXdfbW9udGggPSBcIlNlcFwiXG4gICAgICB3aGVuIDkgdGhlbiBuZXdfbW9udGggPSBcIk9jdFwiXG4gICAgICB3aGVuIDEwIHRoZW4gbmV3X21vbnRoID0gXCJOb3ZcIlxuICAgICAgd2hlbiAxMSB0aGVuIG5ld19tb250aCA9IFwiRGVjXCJcblxuICAgIGhvdXJzID0gQHRpbWVfY3JlYXRlZC5nZXRIb3VycygpXG4gICAgaWYgaG91cnMgPiAxMlxuICAgICAgc3VmZml4ID0gXCJQTVwiXG4gICAgICBuZXdfaG91ciA9IGhvdXJzIC0gMTJcbiAgICBlbHNlXG4gICAgICBzdWZmaXggPSBcIkFNXCJcbiAgICAgIG5ld19ob3VyID0gaG91cnNcblxuICAgIG1pbnV0ZXMgPSBAdGltZV9jcmVhdGVkLmdldE1pbnV0ZXMoKVxuICAgIGlmIG1pbnV0ZXMgPCAxMFxuICAgICAgbmV3X21pbnV0ZXMgPSBcIjAje21pbnV0ZXN9XCJcbiAgICBlbHNlXG4gICAgICBuZXdfbWludXRlcyA9IFwiI3ttaW51dGVzfVwiXG5cbiAgICBmb3JtYXRlZCA9XG4gICAgICBtb250aDogbmV3X21vbnRoXG4gICAgICBkYXk6IEB0aW1lX2NyZWF0ZWQuZ2V0RGF0ZSgpXG4gICAgICBob3VyOiBuZXdfaG91clxuICAgICAgbWludXRlczogbmV3X21pbnV0ZXNcbiAgICAgIHN1ZmZpeDogc3VmZml4XG5cbm1vZHVsZS5leHBvcnRzID0gTWVzc2FnZVxuXG5cbiIsIlxuYXBwID0gcmVxdWlyZSgnLi9hcHAuY29mZmVlJylcbm1lc3NhZ2VfdGVtcGxhdGUgPSByZXF1aXJlKCcuL3RlbXBsYXRlcy9tZXNzYWdlLmhicycpXG5IYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpXG4jIyBIQU5ETEVCQVIgSEVMUEVSIEZVTkNUSU9OIEZPUiBDQUxDVUxBVElORyBUSU1FIFNJTkNFIE1FU1NBR0UgQ1JFQVRJT05cbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgJ2dlbmVyYXRlX21lc3NhZ2VfY29udGVudCcsIC0+XG4gIGlmIEBpbWFnZVxuICAgIG5ldyBIYW5kbGViYXJzLlNhZmVTdHJpbmcoXCI8aW1nIHNyYz0nXCIgKyBAY29udGVudCArIFwiJz5cIilcbiAgZWxzZVxuICAgIEBjb250ZW50XG5cbiMjIGNvbnN0cnVjdG9yIGZvciBvYmplY3QgdGhhdCBjb250YWlucyB0ZW1wbGF0ZSBkYXRhXG4jIyBhbmQgaW50ZXJhY3Rpb24gbG9naWMgZm9yIGluZGl2aWR1YWwgbWVzc2FnZSBtb2RlbHNcbmNsYXNzIE1lc3NhZ2VWaWV3XG5cbiAgY29uc3RydWN0b3I6IChAbWVzc2FnZSkgLT5cblxuXG4gIHJlbmRlcjogLT5cbiAgICAjIyByZW5kZXJzIHRlbXBsYXRlIGRpZmZlcmVudGx5IGlmIHVzZXIgaXMgc2VuZGluZyBvciByZWNpZXZpbmcgdGhlIG1lc3NhZ2VcbiAgICBpZiBAbWVzc2FnZS5zZW5kZXIuaW1hZ2VfdXJsIGlzIGFwcC5tZS5pbWFnZV91cmxcbiAgICAgIEAkZWxlbWVudCA9ICQoJzxsaSBjbGFzcz1cInNlbGZcIj48L2xpPicpLmFwcGVuZChtZXNzYWdlX3RlbXBsYXRlKEBtZXNzYWdlKSlcbiAgICBlbHNlXG4gICAgICBAJGVsZW1lbnQgPSAkKCc8bGkgY2xhc3M9XCJvdGhlclwiPjwvbGk+JykuYXBwZW5kKG1lc3NhZ2VfdGVtcGxhdGUoQG1lc3NhZ2UpKVxuXG5tb2R1bGUuZXhwb3J0cyA9IE1lc3NhZ2VWaWV3IiwiXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuVXNlciA9IHJlcXVpcmUoJy4vdXNlcl9tb2RlbC5jb2ZmZWUnKVxuTWVzc2FnZSA9IHJlcXVpcmUoJy4vbWVzc2FnZV9tb2RlbC5jb2ZmZWUnKVxuXG5cbiMjIEFsbCBsb2dpYyByZWxhdGluZyB0byBsb2dpbmcgaW4gdGhyb3VnaCBHb29nbGUgUGx1cyBPYXV0aFxuIyMgYW5kIGFueSBsb2dpYyB1c2VkIGZvciByZXRyaWV2aW5nIGluZm9ybWF0aW9uIHJlcXVpcmluZyBhbiBhY2Nlc3MgdG9rZW4uXG5jbGFzcyBPYXV0aFxuXG4gIGNvbnN0cnVjdG9yOiAtPlxuXG4gIHdpbmRvdy5zaWduX2luX2NhbGxiYWNrID0gKGF1dGhSZXN1bHQpID0+XG4gICAgaWYgYXV0aFJlc3VsdC5zdGF0dXMuc2lnbmVkX2luXG4gICAgICAjIyB1cGRhdGUgdGhlIGFwcCB0byByZWZsZWN0IHRoZSB1c2VyIGlzIHNpZ25lZCBpbi5cbiAgICAgIGdhcGkuY2xpZW50LmxvYWQgJ3BsdXMnLCAndjEnLCA9PlxuICAgICAgICByZXF1ZXN0ID0gZ2FwaS5jbGllbnQucGx1cy5wZW9wbGUuZ2V0KHsndXNlcklkJzogJ21lJ30pXG4gICAgICAgIHJlcXVlc3QuZXhlY3V0ZSAocHJvZmlsZSkgPT5cbiAgICAgICAgICBkaXNwbGF5X25hbWUgPSBwcm9maWxlLmRpc3BsYXlOYW1lXG4gICAgICAgICAgaW1hZ2VfdXJsID0gcHJvZmlsZS5pbWFnZS51cmxcbiAgICAgICAgICBhcHAubWUgPSBuZXcgVXNlciBkaXNwbGF5X25hbWUsIGltYWdlX3VybFxuICAgICAgICAgIGFwcC5zZXJ2ZXIuZW1pdCgnam9pbicsIGRpc3BsYXlfbmFtZSwgaW1hZ2VfdXJsKVxuICAgICAgICAgIGFwcC5jb21tYW5kX2NlbnRlci5sb2dfaW4oKVxuICAgICAgT2F1dGgucHJvdG90eXBlLmZpbGVfdXBsb2FkID0gKGZpbGUsIGNvbnZvX3BhcnRuZXJzLCBjb252b19pZCkgLT5cbiAgICAgICAgJC5hamF4KHtcbiAgICAgICAgICB1cmw6IFwiaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vdXBsb2FkL3N0b3JhZ2UvdjFiZXRhMi9iL3BhcmxleS1pbWFnZXMvbz91cGxvYWRUeXBlPW1lZGlhJm5hbWU9I3tmaWxlLm5hbWV9XCJcbiAgICAgICAgICB0eXBlOiBcIlBPU1RcIlxuICAgICAgICAgIGRhdGE6IGZpbGVcbiAgICAgICAgICBjb250ZW50VHlwZTogZmlsZS50eXBlXG4gICAgICAgICAgcHJvY2Vzc0RhdGE6IGZhbHNlXG4gICAgICAgICAgaGVhZGVyczpcbiAgICAgICAgICAgIEF1dGhvcml6YXRpb246IFwiQmVhcmVyICN7YXV0aFJlc3VsdC5hY2Nlc3NfdG9rZW59XCJcbiAgICAgICAgICBzdWNjZXNzOiAocmVzKSA9PlxuICAgICAgICAgICAgY29udGVudCA9IFwiaHR0cHM6Ly9zdG9yYWdlLmNsb3VkLmdvb2dsZS5jb20vcGFybGV5LWltYWdlcy8je3Jlcy5uYW1lfVwiXG4gICAgICAgICAgICBuZXdfbWVzc2FnZSA9IG5ldyBNZXNzYWdlIGNvbnZvX3BhcnRuZXJzLCBhcHAubWUsIGNvbnRlbnQsIHRydWVcbiAgICAgICAgICAgIGFwcC5zZXJ2ZXIuZW1pdCAnbWVzc2FnZScsIG5ld19tZXNzYWdlXG4gICAgICAgICAgICBmb3IgY29udm8gaW4gYXBwLmNvbnZlcnNhdGlvbnNcbiAgICAgICAgICAgICAgaWYgY29udm8ubWVzc2FnZV9maWx0ZXIgaXMgY29udm9faWRcbiAgICAgICAgICAgICAgICBjb252by5hZGRfbWVzc2FnZShuZXdfbWVzc2FnZSlcbiAgICAgICAgfSlcbiAgICBlbHNlXG4gICAgICAjIyBsb2dpbiB1bnN1Y2Nlc3NmdWwgbG9nIGVycm9yIHRvIHRoZSBjb25zb2xlXG4gICAgICAjI1Bvc3NpYmxlIGVycm9yIHZhbHVlczpcbiAgICAgICMjXCJ1c2VyX3NpZ25lZF9vdXRcIiAtIFVzZXIgaXMgc2lnbmVkLW91dFxuICAgICAgIyNcImFjY2Vzc19kZW5pZWRcIiAtIFVzZXIgZGVuaWVkIGFjY2VzcyB0byB5b3VyIGFwcFxuICAgICAgIyNcImltbWVkaWF0ZV9mYWlsZWRcIiAtIENvdWxkIG5vdCBhdXRvbWF0aWNhbGx5IGxvZyBpbiB0aGUgdXNlclxuICAgICAgY29uc29sZS5sb2coXCJTaWduLWluIHN0YXRlOiAje2F1dGhSZXN1bHQuZXJyb3J9XCIpXG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IE9hdXRoKCkiLCJhcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuQ2hhdFJvb20gPSByZXF1aXJlKCcuL2NoYXRfcm9vbV92aWV3LmNvZmZlZScpXG5IYW5kbGViYXJzID0gcmVxdWlyZSgnaGFuZGxlYmFycycpXG5wZXJzaXN0ZW50X2NvbnZvX3JlZyA9IHJlcXVpcmUoJy4vdGVtcGxhdGVzL3BlcnNpc3RlbnRfY29udm9fcmVnLmhicycpXG5IYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpXG5cbiMjIEhBTkRMRUJBUlMgSEVMUEVSIEZVTkNUSU9OUyBGT1IgUEVSU0lTVEVOVCBNRVNTQUdFIFRFTVBMQVRFXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyICdyZXRyaWV2ZV9pbWFnZScsIC0+XG4gIEBjb252b19wYXJ0bmVyc19pbWFnZV91cmxzWzBdXG5IYW5kbGViYXJzLnJlZ2lzdGVySGVscGVyICdyZXRyaWV2ZV9sYXN0X21lc3NhZ2UnLCAtPlxuICBsYXN0X21lc3NhZ2UgPSBAbWVzc2FnZXNbQG1lc3NhZ2VzLmxlbmd0aCAtIDFdXG4gIGlmIGxhc3RfbWVzc2FnZS5pbWFnZVxuICAgIGZpbGVfbmFtZSA9IGxhc3RfbWVzc2FnZS5jb250ZW50LnJlcGxhY2UoL14oaHR0cHNcXDpcXC9cXC9zdG9yYWdlXFwuY2xvdWRcXC5nb29nbGVcXC5jb21cXC9wYXJsZXktaW1hZ2VzXFwvKSguKykvLCBcIiQyXCIpXG4gICAgcmV0dXJuIFwiSU1BR0UgTUVTU0FHRTogI3tmaWxlX25hbWV9XCJcbiAgZWxzZVxuICAgIHRydW5jX21lc3NhZ2UgPSBsYXN0X21lc3NhZ2UuY29udGVudC5zbGljZSgwLCAyNSlcbiAgICByZXR1cm4gXCIje3RydW5jX21lc3NhZ2V9Li4uIFwiXG5cbkhhbmRsZWJhcnMucmVnaXN0ZXJIZWxwZXIgJ2NhbGN1bGF0ZV9sYXN0X21lc3NhZ2VfdGltZScsIC0+XG4gIHRoaXMubWVzc2FnZXNbdGhpcy5tZXNzYWdlcy5sZW5ndGggLSAxXS5jYWxjdWxhdGVfdGltZSgpXG5cbiMjIFRoaXMgaXMgdGhlIGNvbnN0cnVjdG9yIGZvciBlYWNoIHBlcnNpc3RlbnQgbWVzc2FnZSBpbiB0aGUgbGlzdCB2aWV3XG4jIyBpdCBjb250YWlucyB0aGUgdGVtcGxhdGUgYW5kbG9naWMgZm9yIHJlbmRlcmluZyB0aGUgbGlzdCB0aGF0IGFwcGVhcnMgaW5cbiMjIGJvdGggdGhlIGNoYXQgd2luZG93IGFuZCBjb21tYW5kIGNlbnRlciB2aWV3cyBhbmQgdGhlIGNvcnJlc3BvbmRpbmcgdXNlciBpbnRlcmFjdGlvbiBsb2dpYy5cbmNsYXNzIFBlcnNpc3RlbnRDb252ZXJzYXRpb25WaWV3XG5cbiAgY29uc3RydWN0b3I6IChAY29udm8pIC0+XG4gICAgQCRlbGVtZW50ID0gJCgnPGRpdiBjbGFzcz1cIm1lc3NhZ2UgZXhpc3RpbmdcIj48L2Rpdj4nKVxuICAgIEAkZWxlbWVudC5vbiAnY2xpY2snLCBAbG9hZF9jb252by5iaW5kKHRoaXMpXG5cbiAgcmVuZGVyOiAtPlxuICAgIEAkZWxlbWVudC5odG1sKHBlcnNpc3RlbnRfY29udm9fcmVnKEBjb252bykpXG5cblxuICBsb2FkX2NvbnZvOiAtPlxuICAgICMjIGlmIGNvbnZvIGlzbid0IG9wZW4gbG9hZCBuZXcgY2hhdCB3aW5kb3cgd2l0aCBjb252b1xuICAgIGNvbnZvX3N0YXR1cyA9ICdjbG9zZWQnXG4gICAgZm9yIG9wZW5fY29udm8gaW4gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAgICAgaWYgQGNvbnZvLm1lc3NhZ2VfZmlsdGVyIGlzIG9wZW5fY29udm9cbiAgICAgICAgY29udm9fc3RhdHVzID0gJ29wZW4nXG5cbiAgICBpZiBjb252b19zdGF0dXMgaXNudCAnb3BlbidcbiAgICAgIGNoYXRfd2luZG93ID0gbmV3IENoYXRSb29tKEBjb252bylcbiAgICAgIGFwcC5vcGVuX2NvbnZlcnNhdGlvbnMucHVzaChAY29udm8ubWVzc2FnZV9maWx0ZXIpXG5cbiAgICAgICMjIGNoZWNrIGFuZCBzZWUgaWYgYWN0aW9uIGlzIGluIGNvbW1hbmQgY2VudGVyIG9yIGNoYXQgd2luZG93XG4gICAgICBpZiBub3QgQCRlbGVtZW50LnBhcmVudCgpLmhhc0NsYXNzKCdjb250cm9sbGVyLXZpZXcnKVxuICAgICAgICBAJGVsZW1lbnQucGFyZW50cygnZGl2LnBhcmxleScpLnJlbW92ZSgpXG5cbm1vZHVsZS5leHBvcnRzID0gUGVyc2lzdGVudENvbnZlcnNhdGlvblZpZXciLCIvLyBoYnNmeSBjb21waWxlZCBIYW5kbGViYXJzIHRlbXBsYXRlXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKTtcbm1vZHVsZS5leHBvcnRzID0gSGFuZGxlYmFycy50ZW1wbGF0ZShmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgdmFyIGJ1ZmZlciA9IFwiXCIsIHN0YWNrMSwgaGVscGVyLCBmdW5jdGlvblR5cGU9XCJmdW5jdGlvblwiLCBlc2NhcGVFeHByZXNzaW9uPXRoaXMuZXNjYXBlRXhwcmVzc2lvbjtcblxuXG4gIGJ1ZmZlciArPSBcIjxkaXYgY2xhc3M9XFxcInBhcmxleVxcXCI+XFxuICA8c2VjdGlvbiBjbGFzcz1cXFwiY29udmVyc2F0aW9uXFxcIj5cXG4gICAgPGRpdiBjbGFzcz1cXFwidG9wLWJhclxcXCI+XFxuICAgICAgPGE+XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLnRpdGxlX2Jhcl9mdW5jdGlvbikgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC50aXRsZV9iYXJfZnVuY3Rpb24pOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9hPlxcbiAgICAgIDx1bCBjbGFzcz1cXFwibWVzc2FnZS1hbHRcXFwiPlxcbiAgICAgICAgPGxpIGNsYXNzPVxcXCJlbnR5cG8tbWludXMgbWluaWZ5XFxcIj48L2xpPlxcbiAgICAgICAgPGxpIGNsYXNzPVxcXCJlbnR5cG8tcmVzaXplLWZ1bGxcXFwiPjwvbGk+XFxuICAgICAgICA8bGkgY2xhc3M9XFxcImVudHlwby1jYW5jZWwgY2hhdC1jbG9zZVxcXCI+PC9saT5cXG4gICAgICA8L3VsPlxcbiAgICA8L2Rpdj5cXG4gICAgPGRpdiBjbGFzcz1cXFwibWVzc2FnZS1iYXJcXFwiPlxcbiAgICAgIDx1bCBjbGFzcz1cXFwiYWRkaXRpb25hbFxcXCI+XFxuICAgICAgICA8bGk+PGEgY2xhc3M9XFxcImVudHlwby11c2VyLWFkZFxcXCI+PC9hPjwvbGk+XFxuICAgICAgPC91bD5cXG4gICAgICA8dWwgY2xhc3M9XFxcImV4aXN0aW5nXFxcIj5cXG4gICAgICAgIDxsaT48YSBjbGFzcz1cXFwiZW50eXBvLWNoYXRcXFwiPjwvYT48L2xpPlxcbiAgICAgIDwvdWw+XFxuICAgIDwvZGl2PlxcbiAgICA8b2wgY2xhc3M9XFxcImRpc2N1c3Npb25cXFwiPjwvb2w+XFxuICAgIDx0ZXh0YXJlYSBjbGFzcz1cXFwic2VuZFxcXCIgcGxhY2Vob2xkZXI9XFxcIkVudGVyIE1lc3NhZ2UuLi5cXFwiPjwvdGV4dGFyZWE+XFxuICAgIDxsYWJlbCBjbGFzcz1cXFwiaW1nX3VwbG9hZCBlbnR5cG8tY2FtZXJhXFxcIj5cXG4gICAgICA8c3Bhbj5cXG4gICAgICAgIDxpbnB1dCBjbGFzcz1cXFwicGFybGV5X2ZpbGVfdXBsb2FkXFxcIiBuYW1lPVxcXCJpbWdfdXBsb2FkXFxcIiB0eXBlPVxcXCJmaWxlXFxcIiAvPlxcbiAgICAgIDwvc3Bhbj5cXG4gICAgIDwvbGFiZWw+XFxuICA8L3NlY3Rpb24+XFxuPC9kaXY+Y1wiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwiYXZhdGFyXFxcIj5cXG4gIDxpbWcgc3JjPSBcIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuaW1hZ2VfdXJsKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmltYWdlX3VybCk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCIgLz5cXG48L2Rpdj5cXG48ZGl2IGNsYXNzPVxcXCJjb250ZW50XFxcIj5cXG4gIDxoMj5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuZGlzcGxheV9uYW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmRpc3BsYXlfbmFtZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L2gyPlxcbjwvZGl2PlxcblwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwicGVyc2lzdGVudC1iYXJcXFwiPlxcbiAgPGltZyBzcmM9XFxcIlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5pbWFnZV91cmwpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuaW1hZ2VfdXJsKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIlxcXCIgLz5cXG4gIDxhPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5kaXNwbGF5X25hbWUpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuZGlzcGxheV9uYW1lKTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIlxcbiAgICA8c3BhbiBjbGFzcz1cXFwiZW50eXBvLWRvd24tb3Blbi1taW5pXFxcIj48L3NwYW4+XFxuICA8L2E+XFxuICA8L2Rpdj5cXG48ZGl2IGNsYXNzPVxcXCJjb250cm9sbGVyLXZpZXdcXFwiPlxcbjwvZGl2PlxcbjxkaXYgY2xhc3M9XFxcImNvbnRyb2xsZXItYmFyXFxcIj5cXG4gIDx1bCBjbGFzcz1cXFwidXRpbGl0eS1iYXIgaG9yaXpvbnRhbC1saXN0XFxcIj5cXG4gICAgPGxpPlxcbiAgICAgIDxhIGNsYXNzPVxcXCJtZXNzYWdlc1xcXCIgPlxcbiAgICAgICAgPHNwYW4gY2xhc3M9XFxcImVudHlwby1jaGF0XFxcIj48L3NwYW4+XFxuICAgICAgPC9hPlxcbiAgICA8L2xpPlxcbiAgICA8bGk+XFxuICAgICAgPGEgY2xhc3M9XFxcInVzZXItc2V0dGluZ3NcXFwiID5cXG4gICAgICAgIDxzcGFuIGNsYXNzPVxcXCJmb250YXdlc29tZS1jb2dcXFwiPjwvc3Bhbj5cXG4gICAgICA8L2E+XFxuICAgIDwvbGk+XFxuICAgIDxsaT5cXG4gICAgICA8YSBjbGFzcz1cXFwiYWN0aXZlLXVzZXJzXFxcIiA+XFxuICAgICAgICA8c3BhbiBjbGFzcz1cXFwiZW50eXBvLXVzZXJzXFxcIj48L3NwYW4+XFxuICAgICAgPC9hPlxcbiAgICA8L2xpPlxcbiAgPC91bD5cXG48L2Rpdj5cIjtcbiAgcmV0dXJuIGJ1ZmZlcjtcbiAgfSk7XG4iLCIvLyBoYnNmeSBjb21waWxlZCBIYW5kbGViYXJzIHRlbXBsYXRlXG52YXIgSGFuZGxlYmFycyA9IHJlcXVpcmUoJ2hic2Z5L3J1bnRpbWUnKTtcbm1vZHVsZS5leHBvcnRzID0gSGFuZGxlYmFycy50ZW1wbGF0ZShmdW5jdGlvbiAoSGFuZGxlYmFycyxkZXB0aDAsaGVscGVycyxwYXJ0aWFscyxkYXRhKSB7XG4gIHRoaXMuY29tcGlsZXJJbmZvID0gWzQsJz49IDEuMC4wJ107XG5oZWxwZXJzID0gdGhpcy5tZXJnZShoZWxwZXJzLCBIYW5kbGViYXJzLmhlbHBlcnMpOyBkYXRhID0gZGF0YSB8fCB7fTtcbiAgXG5cblxuICByZXR1cm4gXCI8ZGl2IGNsYXNzPVxcXCJwYXJsZXlcXFwiPlxcbiAgPHNlY3Rpb24gY2xhc3M9XFxcImNvbnRyb2xsZXJcXFwiPlxcbiAgICAgIDxkaXYgY2xhc3M9XFxcImctc2lnbmluIGxvZ2luLWJhclxcXCJcXG4gICAgICAgIGRhdGEtY2FsbGJhY2s9XFxcInNpZ25faW5fY2FsbGJhY2tcXFwiXFxuICAgICAgICBkYXRhLWNsaWVudGlkPVxcXCIxMDI3NDI3MTE2NzY1LTljMThja3VvMDdyNW1zMGFjbGJmanNtY3BkM2pybXRjLmFwcHMuZ29vZ2xldXNlcmNvbnRlbnQuY29tXFxcIlxcbiAgICAgICAgZGF0YS1jb29raWVwb2xpY3k9XFxcInNpbmdsZV9ob3N0X29yaWdpblxcXCJcXG4gICAgICAgIGRhdGEtdGhlbWU9XFxcIm5vbmVcXFwiXFxuICAgICAgICBkYXRhLXNjb3BlPVxcXCJodHRwczovL3d3dy5nb29nbGVhcGlzLmNvbS9hdXRoL3BsdXMubG9naW4gaHR0cHM6Ly93d3cuZ29vZ2xlYXBpcy5jb20vYXV0aC9kZXZzdG9yYWdlLnJlYWRfd3JpdGVcXFwiPlxcbiAgICAgICAgPGxpIGNsYXNzPVxcXCJidG5cXFwiPlxcbiAgICAgICAgICA8YSBjbGFzcz1cXFwiZW50eXBvLWdwbHVzXFxcIj48L2E+XFxuICAgICAgICA8L2xpPlxcbiAgICAgICAgPGxpIGNsYXNzPVxcXCJhc2lkZVxcXCI+XFxuICAgICAgICAgIDxhPiBTaWduIGluIHdpdGggZ29vZ2xlPC9hPlxcbiAgICAgICAgPC9saT5cXG4gICAgICA8L2Rpdj5cXG4gICAgPGRpdiBjbGFzcz1cXFwicGVyc2lzdGVudC1iYXIgbG9nZ2VkLW91dFxcXCI+XFxuICAgICAgPGEgaWQ9XFxcImxvZy1jbGlja1xcXCI+IGNsaWNrIGhlcmUgdG8gbG9naW4hPC9hPlxcbiAgICAgIDxzcGFuIGNsYXNzPVxcXCJmb250YXdlc29tZS1yZW9yZGVyXFxcIj48L3NwYW4+XFxuICAgIDwvZGl2PlxcbiAgPC9zZWN0aW9uPlxcbjwvZGl2PlwiO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwiYXZhdGFyXFxcIj5cXG4gIDxpbWcgc3JjPVwiXG4gICAgKyBlc2NhcGVFeHByZXNzaW9uKCgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zZW5kZXIpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLmltYWdlX3VybCkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKSlcbiAgICArIFwiIC8+XFxuPC9kaXY+XFxuPGRpdiBjbGFzcz1cXFwibWVzc2FnZSBzdGF0dXNcXFwiPlxcbiAgPGgyPlwiXG4gICAgKyBlc2NhcGVFeHByZXNzaW9uKCgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5zZW5kZXIpKSxzdGFjazEgPT0gbnVsbCB8fCBzdGFjazEgPT09IGZhbHNlID8gc3RhY2sxIDogc3RhY2sxLmRpc3BsYXlfbmFtZSkpLHR5cGVvZiBzdGFjazEgPT09IGZ1bmN0aW9uVHlwZSA/IHN0YWNrMS5hcHBseShkZXB0aDApIDogc3RhY2sxKSlcbiAgICArIFwiPC9oMj5cXG4gIDxwPlwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5nZW5lcmF0ZV9tZXNzYWdlX2NvbnRlbnQpIHsgc3RhY2sxID0gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KTsgfVxuICBlbHNlIHsgaGVscGVyID0gKGRlcHRoMCAmJiBkZXB0aDAuZ2VuZXJhdGVfbWVzc2FnZV9jb250ZW50KTsgc3RhY2sxID0gdHlwZW9mIGhlbHBlciA9PT0gZnVuY3Rpb25UeXBlID8gaGVscGVyLmNhbGwoZGVwdGgwLCB7aGFzaDp7fSxkYXRhOmRhdGF9KSA6IGhlbHBlcjsgfVxuICBidWZmZXIgKz0gZXNjYXBlRXhwcmVzc2lvbihzdGFjazEpXG4gICAgKyBcIjwvcD5cXG4gIDxhIGNsYXNzPVxcXCJ0aW1lXFxcIj5cXG4gICAgPHNwYW4gY2xhc3M9XFxcImVudHlwby1jbG9ja1xcXCI+ICAgXCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLnRpbWVfc2luY2VfY3JlYXRlZCkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC50aW1lX3NpbmNlX2NyZWF0ZWQpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiPC9zcGFuPlxcbiAgPC9hPlxcbjwvZGl2PlwiO1xuICByZXR1cm4gYnVmZmVyO1xuICB9KTtcbiIsIi8vIGhic2Z5IGNvbXBpbGVkIEhhbmRsZWJhcnMgdGVtcGxhdGVcbnZhciBIYW5kbGViYXJzID0gcmVxdWlyZSgnaGJzZnkvcnVudGltZScpO1xubW9kdWxlLmV4cG9ydHMgPSBIYW5kbGViYXJzLnRlbXBsYXRlKGZ1bmN0aW9uIChIYW5kbGViYXJzLGRlcHRoMCxoZWxwZXJzLHBhcnRpYWxzLGRhdGEpIHtcbiAgdGhpcy5jb21waWxlckluZm8gPSBbNCwnPj0gMS4wLjAnXTtcbmhlbHBlcnMgPSB0aGlzLm1lcmdlKGhlbHBlcnMsIEhhbmRsZWJhcnMuaGVscGVycyk7IGRhdGEgPSBkYXRhIHx8IHt9O1xuICB2YXIgYnVmZmVyID0gXCJcIiwgc3RhY2sxLCBoZWxwZXIsIGZ1bmN0aW9uVHlwZT1cImZ1bmN0aW9uXCIsIGVzY2FwZUV4cHJlc3Npb249dGhpcy5lc2NhcGVFeHByZXNzaW9uO1xuXG5cbiAgYnVmZmVyICs9IFwiPGRpdiBjbGFzcz1cXFwiYXZhdGFyXFxcIj5cXG4gIDxpbWcgc3JjPVwiO1xuICBpZiAoaGVscGVyID0gaGVscGVycy5yZXRyaWV2ZV9pbWFnZSkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5yZXRyaWV2ZV9pbWFnZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCIgLz5cXG48L2Rpdj5cXG48ZGl2IGNsYXNzPVxcXCJjb250ZW50IHN0YXR1cyBlbnR5cG8tcmlnaHQtb3Blbi1iaWdcXFwiPlxcbiAgPGgyPlwiXG4gICAgKyBlc2NhcGVFeHByZXNzaW9uKCgoc3RhY2sxID0gKChzdGFjazEgPSAoZGVwdGgwICYmIGRlcHRoMC5jb252b19wYXJ0bmVyKSksc3RhY2sxID09IG51bGwgfHwgc3RhY2sxID09PSBmYWxzZSA/IHN0YWNrMSA6IHN0YWNrMS5kaXNwbGF5X25hbWUpKSx0eXBlb2Ygc3RhY2sxID09PSBmdW5jdGlvblR5cGUgPyBzdGFjazEuYXBwbHkoZGVwdGgwKSA6IHN0YWNrMSkpXG4gICAgKyBcIjwvaDI+XFxuICA8cD5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMucmV0cmlldmVfbGFzdF9tZXNzYWdlKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLnJldHJpZXZlX2xhc3RfbWVzc2FnZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L3A+XFxuICA8YSBjbGFzcz1cXFwidGltZVxcXCI+XFxuICAgIDxzcGFuIGNsYXNzPVxcXCJlbnR5cG8tY2xvY2tcXFwiPiBcIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuY2FsY3VsYXRlX2xhc3RfbWVzc2FnZV90aW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmNhbGN1bGF0ZV9sYXN0X21lc3NhZ2VfdGltZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L3NwYW4+XFxuICA8L2E+XFxuPC9kaXY+XFxuXCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH0pO1xuIiwiLy8gaGJzZnkgY29tcGlsZWQgSGFuZGxlYmFycyB0ZW1wbGF0ZVxudmFyIEhhbmRsZWJhcnMgPSByZXF1aXJlKCdoYnNmeS9ydW50aW1lJyk7XG5tb2R1bGUuZXhwb3J0cyA9IEhhbmRsZWJhcnMudGVtcGxhdGUoZnVuY3Rpb24gKEhhbmRsZWJhcnMsZGVwdGgwLGhlbHBlcnMscGFydGlhbHMsZGF0YSkge1xuICB0aGlzLmNvbXBpbGVySW5mbyA9IFs0LCc+PSAxLjAuMCddO1xuaGVscGVycyA9IHRoaXMubWVyZ2UoaGVscGVycywgSGFuZGxlYmFycy5oZWxwZXJzKTsgZGF0YSA9IGRhdGEgfHwge307XG4gIHZhciBidWZmZXIgPSBcIlwiLCBzdGFjazEsIGhlbHBlciwgZnVuY3Rpb25UeXBlPVwiZnVuY3Rpb25cIiwgZXNjYXBlRXhwcmVzc2lvbj10aGlzLmVzY2FwZUV4cHJlc3Npb247XG5cblxuICBidWZmZXIgKz0gXCI8ZGl2IGNsYXNzPVxcXCJkZWZhdWx0LXZpZXdcXFwiPlxcbiAgPGZpZ3VyZT5cXG4gICAgPGltZyBzcmM9XCI7XG4gIGlmIChoZWxwZXIgPSBoZWxwZXJzLmltYWdlX3VybCkgeyBzdGFjazEgPSBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pOyB9XG4gIGVsc2UgeyBoZWxwZXIgPSAoZGVwdGgwICYmIGRlcHRoMC5pbWFnZV91cmwpOyBzdGFjazEgPSB0eXBlb2YgaGVscGVyID09PSBmdW5jdGlvblR5cGUgPyBoZWxwZXIuY2FsbChkZXB0aDAsIHtoYXNoOnt9LGRhdGE6ZGF0YX0pIDogaGVscGVyOyB9XG4gIGJ1ZmZlciArPSBlc2NhcGVFeHByZXNzaW9uKHN0YWNrMSlcbiAgICArIFwiIC8+XFxuICAgIDxoMj5cIjtcbiAgaWYgKGhlbHBlciA9IGhlbHBlcnMuZGlzcGxheV9uYW1lKSB7IHN0YWNrMSA9IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSk7IH1cbiAgZWxzZSB7IGhlbHBlciA9IChkZXB0aDAgJiYgZGVwdGgwLmRpc3BsYXlfbmFtZSk7IHN0YWNrMSA9IHR5cGVvZiBoZWxwZXIgPT09IGZ1bmN0aW9uVHlwZSA/IGhlbHBlci5jYWxsKGRlcHRoMCwge2hhc2g6e30sZGF0YTpkYXRhfSkgOiBoZWxwZXI7IH1cbiAgYnVmZmVyICs9IGVzY2FwZUV4cHJlc3Npb24oc3RhY2sxKVxuICAgICsgXCI8L2gyPlxcbiAgPC9maWd1cmU+XFxuPC9kaXY+XCI7XG4gIHJldHVybiBidWZmZXI7XG4gIH0pO1xuIiwiXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuXG4jI2NvbnN0cnVjdG9yIGZvciBvYmplY3QgdGhhdCBob2xkcyBhbGxcbiMjZGF0YSBhbmQgbG9naWMgcmVsYXRlZCB0byBlYWNoIHVzZXJcblxuY2xhc3MgVXNlclxuXG4gIGNvbnN0cnVjdG9yOiAoQGRpc3BsYXlfbmFtZSwgQGltYWdlX3VybCkgLT5cbiAgICAjIyBhY3RpdmUsIGlkbGUsIGF3YXksIG9yIERORFxuICAgIEBzdGF0dXMgPSBcImFjdGl2ZVwiXG5cblxubW9kdWxlLmV4cG9ydHMgPSBVc2VyIiwiXG5hcHAgPSByZXF1aXJlKCcuL2FwcC5jb2ZmZWUnKVxuQ2hhdFJvb20gPSByZXF1aXJlKCcuL2NoYXRfcm9vbV92aWV3LmNvZmZlZScpXG5Db252ZXJzYXRpb24gPSByZXF1aXJlKCcuL2NvbnZlcnNhdGlvbl9tb2RlbC5jb2ZmZWUnKVxuY3VycmVudF91c2VyX3RlbXBsYXRlID0gcmVxdWlyZSgnLi90ZW1wbGF0ZXMvY3VycmVudF91c2VyLmhicycpXG5cbiMjIFRoaXMgaXMgdGhlIGNvbnN0cnVjdG9yIGZvciBlYWNoIGxpc3QgaXRlbWNvcnJlc3BvbmRpbmcgdG8gbG9nZ2VkXG4jIyBvbiB1c2VycyBkaXNwbGF5ZWQgaW4gdGhlIGxvZ2dlZCBvbiB1c2VycyBsaXN0IG9uIGJvdGhcbiMjIGNvbW1hbmQgY2VudGVyIGFuZCBjaGF0IHdpbmRvdyB2aWV3cy5cbmNsYXNzIFVzZXJWaWV3XG5cbiAgY29uc3RydWN0b3I6IChAY3VycmVudF91c2VyLCBAY3VycmVudF92aWV3KSAtPlxuICAgIEAkZWxlbWVudCA9ICQoXCI8bGkgY2xhc3M9J3VzZXInPjwvbGk+XCIpXG4gICAgQCRlbGVtZW50Lm9uICdjbGljaycsIEB1c2VyX2ludGVyYWN0X2NhbGxiYWNrLmJpbmQodGhpcylcblxuICByZW5kZXI6IC0+XG4gICAgQCRlbGVtZW50Lmh0bWwoY3VycmVudF91c2VyX3RlbXBsYXRlKEBjdXJyZW50X3VzZXIpKVxuXG4gIHVzZXJfaW50ZXJhY3RfY2FsbGJhY2s6IC0+XG4gICAgIyMgYWRkL3JlbW92ZSB1c2VyIGluIG5ldyBjb252byBidWlsZCBwYXJhbXMgbG9jYXRlZCBpbiBib3RoIGNtZCBjZW50ZXIgYW5kIGNoYXQgd2luZG93cy5cbiAgICAgIGlmIEAkZWxlbWVudC5oYXNDbGFzcygndXNlci1zZWxlY3RlZCcpXG4gICAgICAgIG5ld19wYXJhbXMgPSBbXVxuICAgICAgICBmb3IgdXNlciBpbiBAY3VycmVudF92aWV3Lm5ld19jb252b19wYXJhbXNcbiAgICAgICAgICBpZiB1c2VyLmltYWdlX3VybCBpc250IEBjdXJyZW50X3VzZXIuaW1hZ2VfdXJsXG4gICAgICAgICAgICBuZXdfcGFyYW1zLnB1c2godXNlcilcbiAgICAgICAgQGN1cnJlbnRfdmlldy5uZXdfY29udm9fcGFyYW1zID0gbmV3X3BhcmFtc1xuICAgICAgICBAJGVsZW1lbnQucmVtb3ZlQ2xhc3MoJ3VzZXItc2VsZWN0ZWQnKVxuICAgICAgZWxzZVxuICAgICAgICBAY3VycmVudF92aWV3Lm5ld19jb252b19wYXJhbXMucHVzaChAY3VycmVudF91c2VyKVxuICAgICAgICBAJGVsZW1lbnQuYWRkQ2xhc3MoJ3VzZXItc2VsZWN0ZWQnKVxuICAgICAgIyMgaGFuZGxlIGNvbmZpcm0gYnV0dG9uIERPTSBjbGFzcyBzdHlpbmcgYW5kIGFkZGluZy9yZW1vdmluZyBsaXN0ZW5lclxuICAgICAgY29uc29sZS5sb2coQGN1cnJlbnRfdmlldy5uZXdfY29udm9fcGFyYW1zKVxuXG4gICAgICBpZiBAY3VycmVudF92aWV3Lm5ld19jb252b19wYXJhbXMubGVuZ3RoID4gMFxuICAgICAgICBAY3VycmVudF92aWV3LiRlbGVtZW50LmZpbmQoJy5jb25maXJtJykucmVtb3ZlQ2xhc3MoJ2Rpc2FibGVkJylcbiAgICAgICAgLm9uICdjbGljaycsIEBjdXJyZW50X3ZpZXcuY29uZmlybV9uZXdfY29udm9fcGFyYW1zLmJpbmQoQGN1cnJlbnRfdmlldylcbiAgICAgIGVsc2VcbiAgICAgICAgQGN1cnJlbnRfdmlldy4kZWxlbWVudC5maW5kKCcuY29uZmlybScpLmFkZENsYXNzKCdkaXNhYmxlZCcpLm9mZigpXG5cbiAgIyBvcGVuX2NvbnZlcnNhdGlvbjogLT5cbiAgIyAgICMjIGNoZWNrIHRvIG1ha2Ugc3VyZSBjb252byBpc24ndCBhbHJlYWR5IG9wZW5cbiAgIyAgIGNvbnZvX2tleV9hcnJheSA9IFthcHAubWUuaW1hZ2VfdXJsXS5jb25jYXQoQGN1cnJlbnRfdXNlci5pbWFnZV91cmwpXG4gICMgICBjb252b19pZCA9IGNvbnZvX2tleV9hcnJheS5zb3J0KCkuam9pbigpXG4gICMgICBmb3IgY29udm8gaW4gYXBwLm9wZW5fY29udmVyc2F0aW9uc1xuICAjICAgICBpZiBjb252b19pZCBpcyBjb252b1xuICAjICAgICAgIHJldHVyblxuICAjICAgIyMgY2hlY2sgdG8gc2VlIGlmIHBlcnNpc3RlbnQgY29udm8gZXhpc3RzIHdpdGggdGhlIHVzZXJcbiAgIyAgIGNvbnZvX2V4aXN0cyA9IGZhbHNlXG4gICMgICBmb3IgY29udm8gaW4gYXBwLmNvbnZlcnNhdGlvbnNcbiAgIyAgICAgaWYgY29udm8ubWVzc2FnZV9maWx0ZXIgaXMgY29udm9faWRcbiAgIyAgICAgICBjb252b19leGlzdHMgPSB0cnVlXG4gICMgICAgICAgY29udm8gPSBjb252b1xuICAjICAgaWYgY29udm9fZXhpc3RzXG4gICMgICAgIGNoYXRfd2luZG93ID0gbmV3IENoYXRSb29tKGNvbnZvKVxuICAjICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG4gICMgICBlbHNlXG4gICMgICAgIGNvbnZlcnNhdGlvbiA9IG5ldyBDb252ZXJzYXRpb24oW0BjdXJyZW50X3VzZXJdKVxuICAjICAgICBjaGF0X3dpbmRvdyA9IG5ldyBDaGF0Um9vbShjb252ZXJzYXRpb24pXG4gICMgICAgIGFwcC5jb252ZXJzYXRpb25zLnB1c2goY29udmVyc2F0aW9uKVxuICAjICAgICBhcHAub3Blbl9jb252ZXJzYXRpb25zLnB1c2goY29udm9faWQpXG5cbm1vZHVsZS5leHBvcnRzID0gVXNlclZpZXciXX0=
