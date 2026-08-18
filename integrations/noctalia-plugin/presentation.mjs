// Import-free for QML and node. QV4 cannot parse object spread.
export function stepPrecision(step) {
  var text = String(step).toLowerCase();
  var exponentAt = text.indexOf('e-');
  if (exponentAt !== -1) {
    var coefficient = text.slice(0, exponentAt);
    var fractional = coefficient.indexOf('.') === -1
      ? 0
      : coefficient.length - coefficient.indexOf('.') - 1;
    return Number(text.slice(exponentAt + 2)) + fractional;
  }
  return text.indexOf('.') === -1 ? 0 : text.length - text.indexOf('.') - 1;
}

function display(param) {
  return param.ui.display === undefined ? 'raw' : param.ui.display;
}

function scale(param) {
  return param.ui.scale === undefined ? 'linear' : param.ui.scale;
}

function percentPrecision(param) {
  var precision = Math.max(stepPrecision(param.ui.step),
                           stepPrecision(param.range[0]), stepPrecision(param.range[1]));
  return Math.max(0, precision - 2);
}

function asPercent(value, param) {
  return Number((value * 100).toFixed(percentPrecision(param)));
}

function normalized(value, param) {
  var low = param.range[0];
  var high = param.range[1];
  if (scale(param) === 'logarithmic') {
    return Math.log(value / low) / Math.log(high / low);
  }
  return (value - low) / (high - low);
}

function denormalized(value, param) {
  var low = param.range[0];
  var high = param.range[1];
  if (scale(param) === 'logarithmic') {
    return low * Math.pow(high / low, value);
  }
  return low + value * (high - low);
}

export function snapValue(value, range, step) {
  var clamped = Math.max(range[0], Math.min(range[1], value));
  var snapped = range[0] + Math.round((clamped - range[0]) / step) * step;
  snapped = Math.max(range[0], Math.min(range[1], snapped));
  var precision = Math.max(stepPrecision(step),
                           stepPrecision(range[0]), stepPrecision(range[1]));
  return Number(snapped.toFixed(precision));
}

export function sliderFrom(param) {
  if (display(param) === 'percent') return asPercent(param.range[0], param);
  if (display(param) === 'normalized' || scale(param) === 'logarithmic') return 0;
  return param.range[0];
}

export function sliderTo(param) {
  if (display(param) === 'percent') return asPercent(param.range[1], param);
  if (display(param) === 'normalized' || scale(param) === 'logarithmic') return 1;
  return param.range[1];
}

export function sliderStep(param) {
  if (display(param) === 'percent') return asPercent(param.ui.step, param);
  if (display(param) === 'normalized' || scale(param) === 'logarithmic') return 0;
  return param.ui.step;
}

export function toSliderValue(value, param) {
  if (display(param) === 'percent') return asPercent(value, param);
  if (display(param) === 'normalized' || scale(param) === 'logarithmic') {
    return normalized(value, param);
  }
  return value;
}

export function canonicalFromSlider(value, param) {
  var canonical = value;
  if (display(param) === 'percent') canonical = value / 100;
  else if (display(param) === 'normalized' || scale(param) === 'logarithmic') {
    canonical = denormalized(value, param);
  }
  return snapValue(canonical, param.range, param.ui.step);
}

export function stepCanonicalValue(value, direction, param) {
  if (direction === 0) return value;
  return snapValue(value + Math.sign(direction) * param.ui.step,
                   param.range, param.ui.step);
}

export function formatValue(value, param) {
  var shown = value;
  var precision = stepPrecision(param.ui.step);
  var suffix = param.ui.unit === undefined ? '' : param.ui.unit;
  if (display(param) === 'percent') {
    shown = asPercent(value, param);
    precision = percentPrecision(param);
    suffix = '%';
  } else if (display(param) === 'normalized') {
    shown = normalized(value, param);
    precision = 3;
  }
  return String(Number(shown.toFixed(precision))) + suffix;
}

export function oppositeSide(panelCenterX, screenCenterX) {
  return panelCenterX <= screenCenterX ? 'right' : 'left';
}

export function titleParam(params) {
  var matches = [];
  for (var i = 0; i < params.length; i++) {
    if (params[i].ui.control !== 'none' && params[i].ui.group === 'Title') {
      matches.push(params[i]);
    }
  }
  if (matches.length !== 1 || matches[0].ui.control !== 'toggle') {
    throw new Error('Title must contain exactly one visible toggle');
  }
  return matches[0];
}

export function groupParams(params) {
  var visible = [];
  for (var i = 0; i < params.length; i++) {
    if (params[i].ui.control !== 'none' && params[i].ui.group !== 'Title') {
      visible.push(params[i]);
    }
  }
  visible.sort(function(a, b) { return a.ui.order - b.ui.order; });

  var groups = [];
  var byName = {};
  for (var j = 0; j < visible.length; j++) {
    var name = visible[j].ui.group;
    if (!Object.prototype.hasOwnProperty.call(byName, name)) {
      byName[name] = { name: name, params: [] };
      groups.push(byName[name]);
    }
    byName[name].params.push(visible[j]);
  }

  for (var k = 0; k < groups.length; k++) {
    if (groups[k].name === 'Quick' && k !== 0) {
      groups.unshift(groups.splice(k, 1)[0]);
      break;
    }
  }
  return groups;
}
