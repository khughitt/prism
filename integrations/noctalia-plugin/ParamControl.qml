import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import qs.Widgets
import "./presentation.mjs" as Presentation

RowLayout {
  id: root

  required property var param
  required property var client
  property var screen: null
  readonly property real stepSize: param.ui.step === undefined ? 0.01 : param.ui.step
  readonly property bool liveDrag: param.effectiveDrag === "live"

  enabled: param.effectiveDrag !== null
  spacing: Style.marginM

  function sendSlider(value, sample) {
    client.set(param.key, Presentation.quantizeValue(value, stepSize), sample);
  }

  function selectOptions(values) {
    var result = [];
    for (var i = 0; i < values.length; i++) {
      result.push({ key: values[i], name: values[i] });
    }
    return result;
  }

  function colorHex(color) {
    var text = String(color);
    return "#" + text.slice(text.length - 6).toLowerCase();
  }

  ColumnLayout {
    Layout.fillWidth: true
    spacing: Style.marginXS

    NText {
      visible: root.param.effectiveDrag === null || root.param.effectiveDrag === "release"
      Layout.alignment: Qt.AlignRight
      text: root.param.effectiveDrag === null ? "unavailable" : "on release"
      color: Color.mOnSurfaceVariant
      pointSize: Style.fontSizeS
      opacity: 0.6
    }

    NValueSlider {
      id: valueSlider

      visible: root.param.ui.control === "slider"
      Layout.fillWidth: true
      property bool pointerPressed: false
      property real pendingValue: 0
      label: root.param.ui.label || ""
      description: root.param.description || ""
      defaultValue: root.param.default
      showReset: false
      from: root.param.range ? root.param.range[0] : 0
      to: root.param.range ? root.param.range[1] : 1
      stepSize: root.stepSize
      value: root.param.value
      text: Presentation.formatValue(value, stepSize)

      Component.onDestruction: {
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
        if (pointerPressed) {
          if (liveDrag && !sampleGate.running) {
            sendSlider(value, true);
            sampleGate.restart();
          }
        } else {
          pendingValue = value;
          commitGate.restart();
        }
      }

      onPressedChanged: function(pressed, value) {
        pointerPressed = pressed;
        commitGate.stop();
        if (!pressed) {
          sendSlider(value, false);
        }
      }
    }

    NToggle {
      visible: root.param.ui.control === "toggle"
      label: root.param.ui.label || ""
      description: root.param.description || ""
      defaultValue: root.param.default
      checked: root.param.value === true
      onToggled: checked => root.client.set(root.param.key, checked, false)
    }

    NComboBox {
      visible: root.param.ui.control === "select"
      Layout.fillWidth: true
      label: root.param.ui.label || ""
      description: root.param.description || ""
      defaultValue: root.param.default
      model: root.selectOptions(root.param.values || [])
      currentKey: String(root.param.value)
      onSelected: key => root.client.set(root.param.key, key, false)
    }

    RowLayout {
      visible: root.param.ui.control === "color"
      Layout.fillWidth: true
      spacing: Style.marginL

      NLabel {
        Layout.fillWidth: true
        label: root.param.ui.label || ""
        description: root.param.description || ""
      }

      NColorPicker {
        screen: root.screen
        selectedColor: root.param.value
        onColorSelected: color => root.client.set(root.param.key, root.colorHex(color), false)
      }
    }
  }

  NIconButton {
    visible: root.param.modified
    Layout.preferredWidth: Math.round(30 * Style.uiScaleRatio)
    Layout.preferredHeight: Math.round(30 * Style.uiScaleRatio)
    baseSize: Style.baseWidgetSize * 0.7
    icon: "restore"
    tooltipText: "Reset to default"
    onClicked: root.client.unset(root.param.key)
  }
}
