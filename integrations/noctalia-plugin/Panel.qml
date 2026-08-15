import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import qs.Widgets

Item {
  property var pluginApi: null

  id: root

  property bool allowAttach: true
  property real contentPreferredWidth: Math.round(560 * Style.uiScaleRatio)
  property real contentPreferredHeight: Math.round(760 * Style.uiScaleRatio)
  property var groups: []
  readonly property var client: pluginApi && pluginApi.mainInstance ? pluginApi.mainInstance.client : null
  readonly property string errorMessage: client ? client.errorMessage : ""

  function groupedParams(params) {
    var byName = {};
    var names = [];

    for (var i = 0; i < params.length; i++) {
      var param = params[i];
      if (param.ui.control === "none") {
        continue;
      }
      var name = param.ui.group;
      if (!byName[name]) {
        byName[name] = [];
        names.push(name);
      }
      byName[name].push(param);
    }

    var result = [];
    for (var j = 0; j < names.length; j++) {
      result.push({ name: names[j], params: byName[names[j]] });
    }
    return result;
  }

  function resetGroup(params) {
    for (var i = 0; i < params.length; i++) {
      if (params[i].modified) {
        client.unset(params[i].key);
      }
    }
  }

  function groupModified(params) {
    for (var i = 0; i < params.length; i++) {
      if (params[i].modified) {
        return true;
      }
    }
    return false;
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

  Component.onCompleted: client.refresh()

  Connections {
    target: pluginApi ? pluginApi : null

    function onPanelOpenScreenChanged() {
      if (pluginApi && pluginApi.panelOpenScreen) {
        client.refresh();
      }
    }
  }

  Connections {
    target: client

    function onDescribed(model) {
      root.groups = root.groupedParams(model.params);
    }
  }

  ColumnLayout {
    anchors.fill: parent
    anchors.margins: Style.marginL
    spacing: Style.marginM

    NText {
      text: "Prism"
      pointSize: Style.fontSizeXL
      font.weight: Style.fontWeightBold
    }

    Rectangle {
      visible: root.errorMessage !== ""
      Layout.fillWidth: true
      implicitHeight: errorText.implicitHeight + Style.marginM * 2
      radius: Style.radiusS
      color: Qt.alpha(Color.mError, 0.12)
      border.color: Color.mError
      border.width: Style.borderS

      NText {
        id: errorText
        anchors.fill: parent
        anchors.margins: Style.marginM
        text: root.errorMessage
        color: Color.mError
        wrapMode: Text.WordWrap
      }
    }

    NScrollView {
      Layout.fillWidth: true
      Layout.fillHeight: true
      horizontalPolicy: ScrollBar.AlwaysOff
      verticalPolicy: ScrollBar.AsNeeded
      reserveScrollbarSpace: false
      gradientColor: Color.mSurface

      ColumnLayout {
        width: parent.width
        spacing: Style.marginL

        Repeater {
          model: root.groups

          ColumnLayout {
            required property var modelData
            property var groupParams: modelData.params

            Layout.fillWidth: true
            spacing: Style.marginM

            RowLayout {
              Layout.fillWidth: true

              NText {
                Layout.fillWidth: true
                text: modelData.name
                pointSize: Style.fontSizeL
                font.weight: Style.fontWeightBold
              }

              NButton {
                visible: root.groupModified(groupParams)
                text: "reset group"
                outlined: true
                onClicked: root.resetGroup(groupParams)
              }
            }

            Repeater {
              model: groupParams

              ColumnLayout {
                required property var modelData

                Layout.fillWidth: true
                spacing: Style.marginXS
                enabled: modelData.effectiveLiveness !== null

                RowLayout {
                  Layout.fillWidth: true

                  NText {
                    Layout.fillWidth: true
                    text: modelData.key.split(".").slice(1).join(" ")
                  }

                  NText {
                    text: modelData.effectiveLiveness || "unbound"
                    opacity: modelData.effectiveLiveness ? 1.0 : 0.4
                    color: Color.mOnSurfaceVariant
                    pointSize: Style.fontSizeS
                  }

                  NIconButton {
                    visible: modelData.modified
                    icon: "restore"
                    tooltipText: "Reset to default"
                    onClicked: client.unset(modelData.key)
                  }
                }

                NValueSlider {
                  id: valueSlider

                  visible: modelData.ui.control === "slider"
                  Layout.fillWidth: true
                  property bool liveDrag: modelData.effectiveLiveness === "live"
                  property bool pointerPressed: false
                  from: modelData.range ? modelData.range[0] : 0
                  to: modelData.range ? modelData.range[1] : 1
                  stepSize: modelData.ui.step === undefined ? 0.01 : modelData.ui.step
                  value: modelData.value
                  text: String(value)

                  Timer {
                    id: sampleGate
                    interval: 100
                    repeat: false
                  }

                  Timer {
                    id: commitGate
                    interval: 100
                    repeat: false
                    onTriggered: client.set(modelData.key, valueSlider.value, false)
                  }

                  onMoved: function(value) {
                    if (pointerPressed) {
                      if (liveDrag && !sampleGate.running) {
                        client.set(modelData.key, value, true);
                        sampleGate.restart();
                      }
                    } else {
                      commitGate.restart();
                    }
                  }

                  onPressedChanged: function(pressed, value) {
                    pointerPressed = pressed;
                    commitGate.stop();
                    if (!pressed) {
                      client.set(modelData.key, value, false);
                    }
                  }
                }

                NToggle {
                  visible: modelData.ui.control === "toggle"
                  checked: modelData.value === true
                  onToggled: checked => client.set(modelData.key, checked, false)
                }

                NComboBox {
                  visible: modelData.ui.control === "select"
                  Layout.fillWidth: true
                  model: root.selectOptions(modelData.values || [])
                  currentKey: String(modelData.value)
                  onSelected: key => client.set(modelData.key, key, false)
                }

                NColorPicker {
                  visible: modelData.ui.control === "color"
                  screen: root.pluginApi ? root.pluginApi.panelOpenScreen : null
                  selectedColor: modelData.value
                  onColorSelected: color => client.set(modelData.key, root.colorHex(color), false)
                }
              }
            }
          }
        }
      }
    }
  }
}
