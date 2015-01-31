var domify = require('domify');
var dom = require('ampersand-dom');
var each = require('amp-each');
var uniqId = require('amp-unique-id');

var defaultTemplate = [
  '<div>',
    '<label data-hook="label"></label>',
    '<div data-hook="message-container">',
      '<div data-hook="message-text"></div>',
    '</div>',
    '<ul data-hook="container"></ul>',
  '</div>'
].join('');

var radioTemplate = [
  '<li>',
    '<input type="radio">',
    '<label data-hook="label"></label>',
  '</li>'
].join('');

function RadioView(opts) {
  opts = opts || {};

  if (typeof opts.name !== 'string') throw new Error('RadioView requires a name property.');
  this.name = opts.name;

  if (!Array.isArray(opts.options) && !opts.options.isCollection) {
    throw new Error('RadioView requires select options.');
  }
  this.options = opts.options;

  if (this.options.isCollection) {
    this.idAttribute = opts.idAttribute || this.options.mainIndex || 'id';
    this.textAttribute = opts.textAttribute || 'text';
    this.options.on('add', function () {
      this.renderOptions();
      this.updateSelectedOption();
    }.bind(this));
  }

  this.el = opts.el;
  this.value = null;
  this.startingValue = opts.value;
  this.label = opts.label || this.name;
  this.parent = opts.parent;
  this.template = opts.template || defaultTemplate;

  this.required = opts.required || false;
  this.className = opts.className;
  this.validClass = opts.validClass || 'input-valid';
  this.invalidClass = opts.invalidClass || 'input-invalid';
  this.requiredMessage = opts.requiredMessage || 'Selection required';
  this.shouldValidate = !!opts.shouldValidate;

  this.render();

  this.setValue(opts.value);
}

RadioView.prototype.render = function () {
  if (this.rendered) return;

  if (!this.el) this.el = domify(this.template);
  if (this.className) {
    var el = this.el;
    each(this.className.split(' '), function (cl) {
      el.classList.add(cl);
    });
  }

  var label = this.el.querySelector('[data-hook~=label]');
  if (label) {
    label.innerHTML = this.label;
  }

  this.el.addEventListener('change', this.onChange.bind(this));

  this.renderOptions();
  this.updateSelectedOption();

  this.rendered = true;
};

RadioView.prototype.findModelForId = function (id) {
  return this.options.filter(function (model) {
    if (!model[this.idAttribute]) return false;

    //intentionally coerce for '1' == 1
    return model[this.idAttribute] == id;
  }.bind(this))[0];
};

RadioView.prototype.renderOptions = function () {
  if (!this.el) return;

  var container = this.el.querySelector('[data-hook=container]');

  container.innerHTML = '';

  this.options.forEach(function (option) {
    container.appendChild(this.createOption(this.getOptionValue(option), this.getOptionText(option), this.name));
  }.bind(this));
};

RadioView.prototype.updateSelectedOption = function () {
  var lookupValue = this.value;
  var options;
  var currentlySelected;

  if (!this.el) return;

  if (lookupValue == null) {
    this.el.classList.add('unselected');
    if (currentlySelected = this.el.querySelector('input[type=radio]:checked')) {
      currentlySelected.checked = false;
    }
    return;
  }

  if (this.options.isCollection && this.yieldModel) {
    lookupValue = lookupValue[this.idAttribute] || lookupValue;
  }

  options = this.el.querySelectorAll('input[type=radio]');
  for (var i = 0; i < options.length; i++) {
    if (options[i].value == lookupValue.toString()) {
      options[i].checked = true;
      this.el.classList.remove('unselected');
      return;
    }
  }
};

RadioView.prototype.onChange = function (e) {
  this.setValue(e.target.value)
};

RadioView.prototype.remove = function () {
  if (this.el) {
    this.el.removeEventListener('change', this.onChange, false);
    if (this.el.parentNode) {
      this.el.parentNode.removeChild(this.el);
    }
  }
  // TODO: remove listener on collection
};

RadioView.prototype.setValue = function (value) {
  if (value == this.value) return;

  if (this.options.isCollection) {
    var model;

    if (this.options.indexOf(value) === -1) {
      model = this.findModelForId(value);
    } else {
      model = value;
    }

    if (this.yieldModel) {
      value = model;
    } else {
      if (model) {
        value = model[this.idAttribute];
      } else {
        value = void 0;
      }
    }
  }

  this.value = value;
  this.validate();
  this.updateSelectedOption();
  if (this.parent) this.parent.update(this);
};

RadioView.prototype.validate = function () {
  this.valid = !this.required || this.options.some(function (element) {

    if (this.options.isCollection) {
      if (this.yieldModel) {
        return this.options.indexOf(this.value) > -1;
      } else {
        return !!this.findModelForId(this.value);
      }
    }

    //[ ['foo', 'Foo Text'], ['bar', 'Bar Text'] ]
    if (Array.isArray(element) && element.length === 2) {
      return element[0] == this.value;
    }

    //[ 'foo', 'bar', 'baz' ]
    return element == this.value;
  }.bind(this));

  if (!this.valid && this.shouldValidate) {
    this.setMessage(this.requiredMessage);
  } else {
    this.setMessage();
  }

  return this.valid;
};

RadioView.prototype.getOptionValue = function (option) {
  if (Array.isArray(option)) return option[0];

  if (this.options.isCollection) {
    if (this.idAttribute && option[this.idAttribute]) {
      return option[this.idAttribute];
    }
  }

  return option;
};

RadioView.prototype.setMessage = function (message) {
  var mContainer = this.el.querySelector('[data-hook~=message-container]');
  var mText = this.el.querySelector('[data-hook~=message-text]');

  if (!mContainer || !mText) return;

  if (message) { // TODO: why cant i show a happy message???
    dom.show(mContainer);
    mText.textContent = message;
    dom.addClass(this.el, this.invalidClass);
    dom.removeClass(this.el, this.validClass);
  } else {
    dom.hide(mContainer);
    mText.textContent = '';
    dom.addClass(this.el, this.validClass);
    dom.removeClass(this.el, this.invalidClass);
  }
};

RadioView.prototype.beforeSubmit = function () {
  this.shouldValidate = true;
  this.validate();
};

RadioView.prototype.getOptionText = function (option) {
  if (Array.isArray(option)) return option[1];

  if (this.options.isCollection) {
    if (this.textAttribute && option[this.textAttribute]) {
      return option[this.textAttribute];
    }
  }

  return option;
};

RadioView.prototype.createOption = function (value, text, name, id) {
  var node = domify(radioTemplate),
      input = node.querySelector('input'),
      label = node.querySelector('[data-hook=label]');

  id = id || uniqId(name + '_' + value);

  if (label) {
    label.textContent = text;
    label.setAttribute('for', id);
  }

  input.id = id;
  input.name = name;
  input.value = value;

  return node;
};

RadioView.prototype.reset = function () {
  this.setValue(this.startingValue);
};

module.exports = RadioView;
