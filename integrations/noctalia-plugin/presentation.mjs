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

export function quantizeValue(value, step) {
  return Number(Number(value).toFixed(stepPrecision(step)));
}

export function formatValue(value, step) {
  return String(quantizeValue(value, step));
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
