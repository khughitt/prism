import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import qs.Widgets
import "./presentation.mjs" as Presentation

ColumnLayout {
  id: root

  required property var param
  required property var client
  property var screen: null
  property var displayedValue: param.value
  readonly property bool liveDrag: param.effectiveDrag === "live"

  enabled: param.effectiveDrag !== null
  spacing: Style.marginXS

  function sendSlider(value, sample) {
    client.set(param.key, value, sample);
  }

  function selectOptions(values) {
    var result = [];
    for (var i = 0; i < values.length; i++) {
      result.push({ key: values[i], name: values[i] });
    }
    return result;
  }

  function canonicalForMove(value) {
    if (valueSlider.stepSize === 0 && !valueSlider.pointerPressed) {
      var current = Presentation.toSliderValue(root.displayedValue, root.param);
      return Presentation.stepCanonicalValue(
        root.displayedValue, Math.sign(value - current), root.param);
    }
    return Presentation.canonicalFromSlider(value, root.param);
  }

  function colorHex(color) {
    var text = String(color);
    return "#" + text.slice(text.length - 6).toLowerCase();
  }

  NText {
    id: parameterLabel

    Layout.fillWidth: true
    text: root.param.ui.label || ""
    pointSize: Style.fontSizeM
    font.weight: Style.fontWeightMedium
  }

  NText {
    id: parameterDescription

    Layout.fillWidth: true
    text: root.param.description || ""
    pointSize: Style.fontSizeS
    color: Color.mOnSurfaceVariant
    elide: Text.ElideRight
  }

  RowLayout {
    id: controlRow

    Layout.fillWidth: true

    NValueSlider {
      id: valueSlider

      visible: root.param.ui.control === "slider"
      Layout.fillWidth: true
      property bool pointerPressed: false
      property real pendingValue: 0
      label: ""
      description: ""
      showReset: false
      from: Presentation.sliderFrom(root.param)
      to: Presentation.sliderTo(root.param)
      stepSize: Presentation.sliderStep(root.param)
      value: Presentation.toSliderValue(root.displayedValue, root.param)
      text: Presentation.formatValue(root.displayedValue, root.param)
      textSize: Style.fontSizeS

      WheelHandler {
        onWheel: function(event) {
          var direction = Math.sign(event.angleDelta.y);
          if (direction === 0) return;
          var step = valueSlider.stepSize === 0 ? 1 : valueSlider.stepSize;
          var current = Presentation.toSliderValue(root.displayedValue, root.param);
          valueSlider.moved(current + direction * step);
        }
      }

      Component.onDestruction: {
        if (pointerPressed) root.client.setSliderPressed(false);
        if (commitGate.running) {
          commitGate.stop();
          sendSlider(valueSlider.pendingValue, false);
        }
      }

      Timer {
        id: sampleGate
        interval: 100
        repeat: false
      }

      Timer {
        id: commitGate
        interval: 100
        repeat: false
        onTriggered: sendSlider(valueSlider.pendingValue, false)
      }

      onMoved: function(value) {
        var canonical = root.canonicalForMove(value);
        root.displayedValue = canonical;
        if (pointerPressed) {
          if (liveDrag && !sampleGate.running) {
            sendSlider(canonical, true);
            sampleGate.restart();
          }
        } else {
          pendingValue = canonical;
          commitGate.restart();
        }
      }

      onPressedChanged: function(pressed, value) {
        pointerPressed = pressed;
        if (pressed) root.client.setSliderPressed(true);
        commitGate.stop();
        if (!pressed) {
          var canonical = Presentation.canonicalFromSlider(value, root.param);
          root.displayedValue = canonical;
          sendSlider(canonical, false);
          root.client.setSliderPressed(false);
        }
      }
    }

    NToggle {
      visible: root.param.ui.control === "toggle"
      label: ""
      description: ""
      checked: root.displayedValue === true
      onToggled: function(checked) {
        root.displayedValue = checked;
        root.client.set(root.param.key, checked, false);
      }
    }

    NComboBox {
      visible: root.param.ui.control === "select"
      Layout.fillWidth: true
      label: ""
      description: ""
      model: root.selectOptions(root.param.values || [])
      currentKey: String(root.displayedValue)
      onSelected: function(key) {
        root.displayedValue = key;
        root.client.set(root.param.key, key, false);
      }
    }

    NColorPicker {
      visible: root.param.ui.control === "color"
      Layout.fillWidth: true
      screen: root.screen
      selectedColor: root.displayedValue
      onColorSelected: function(color) {
        var hex = root.colorHex(color);
        root.displayedValue = hex;
        root.client.set(root.param.key, hex, false);
      }
    }

    Item {
      Layout.fillWidth: true
    }

    NText {
      id: livenessHint

      visible: root.param.effectiveDrag === null || root.param.effectiveDrag === "release"
      text: root.param.effectiveDrag === null ? "unavailable" : "on release"
      pointSize: Style.fontSizeXS
      color: Color.mOnSurfaceVariant
      opacity: 0.55
    }

    NIconButton {
      id: resetButton

      visible: root.param.modified
      baseSize: Style.baseWidgetSize * 0.6
      icon: "restore"
      tooltipText: "Reset to default"
      onClicked: {
        root.displayedValue = root.param.default;
        root.client.unset(root.param.key);
      }
    }
  }
}
