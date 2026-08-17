import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import qs.Commons
import qs.Widgets
import "./presentation.mjs" as Presentation

Item {
  id: root

  property var pluginApi: null
  property bool allowAttach: true
  property real contentPreferredWidth: Math.round(560 * Style.uiScaleRatio)
  property real contentPreferredHeight: Math.round(760 * Style.uiScaleRatio)
  property var groups: []
  property var titleSetting: null
  property bool titleValue: true
  property var expandedGroups: ({})
  property bool previewVisible: false
  property bool diagnosticBackground: false
  readonly property var client: pluginApi && pluginApi.mainInstance ? pluginApi.mainInstance.client : null
  readonly property string errorMessage: client ? client.errorMessage : ""

  function setGroupExpanded(name, expanded) {
    var next = {};
    var keys = Object.keys(root.expandedGroups);
    for (var i = 0; i < keys.length; i++) {
      next[keys[i]] = root.expandedGroups[keys[i]];
    }
    next[name] = expanded;
    root.expandedGroups = next;
  }

  function resetGroup(params) {
    for (var i = 0; i < params.length; i++) {
      if (params[i].modified) {
        client.unset(params[i].key);
      }
    }
  }

  function groupModifiedCount(params) {
    var count = 0;
    for (var i = 0; i < params.length; i++) {
      if (params[i].modified) {
        count++;
      }
    }
    return count;
  }

  function previewSide() {
    var screen = root.pluginApi ? root.pluginApi.panelOpenScreen : null;
    if (!screen) return "right";
    var panelCenter = root.mapToGlobal(root.width / 2, root.height / 2).x;
    return Presentation.oppositeSide(panelCenter, screen.x + screen.width / 2);
  }

  function updatePreview() {
    var screen = root.pluginApi ? root.pluginApi.panelOpenScreen : null;
    if (root.previewVisible && screen) {
      root.client.showPreview(screen.name, root.previewSide(), root.diagnosticBackground);
    }
  }

  Component.onCompleted: client.refresh()
  Component.onDestruction: if (root.client) root.client.hidePreview()

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
      root.titleSetting = Presentation.titleParam(model.params);
      root.titleValue = root.titleSetting.value === true;
      root.groups = Presentation.groupParams(model.params);
    }
  }

  ColumnLayout {
    anchors.fill: parent
    anchors.margins: Style.marginM
    spacing: Style.marginM

    RowLayout {
      Layout.fillWidth: true

      NText {
        Layout.fillWidth: true
        text: "Prism"
        pointSize: Style.fontSizeL
        font.weight: Style.fontWeightBold
      }

      NText {
        visible: root.titleSetting !== null
        text: root.titleSetting ? root.titleSetting.ui.label : ""
        pointSize: Style.fontSizeS
      }

      NToggle {
        visible: root.titleSetting !== null
        Layout.fillWidth: false
        label: ""
        description: ""
        checked: root.titleValue
        onToggled: function(checked) {
          root.titleValue = checked;
          root.client.set(root.titleSetting.key, checked, false);
        }
      }
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
      gradientColor: Color.mSurface

      ColumnLayout {
        width: parent.width
        spacing: Style.marginM

        Repeater {
          model: root.groups

          Rectangle {
            id: groupSurface

            required property var modelData
            property var groupParams: modelData.params
            readonly property bool quick: modelData.name === "Quick"
            readonly property bool expanded: root.expandedGroups[modelData.name] === true
            readonly property int modifiedCount: root.groupModifiedCount(groupParams)

            Layout.fillWidth: true
            implicitHeight: groupContent.implicitHeight + (quick ? Style.marginS * 2 : 0)
            radius: Style.radiusS
            color: quick ? Qt.alpha(Color.mSurfaceVariant, 0.45) : "transparent"

            ColumnLayout {
              id: groupContent

              anchors.fill: parent
              anchors.margins: groupSurface.quick ? Style.marginS : 0
              spacing: Style.marginM

              Rectangle {
                id: groupHeader

                visible: !groupSurface.quick
                Layout.fillWidth: true
                implicitHeight: headerContent.implicitHeight + Style.marginS * 2
                radius: Style.radiusS
                color: headerArea.containsMouse ? Qt.alpha(Color.mOnSurface, 0.06) : "transparent"

                MouseArea {
                  id: headerArea
                  anchors.fill: parent
                  cursorShape: Qt.PointingHandCursor
                  hoverEnabled: true
                  onClicked: root.setGroupExpanded(groupSurface.modelData.name, !groupSurface.expanded)
                }

                RowLayout {
                  id: headerContent
                  anchors.fill: parent
                  anchors.leftMargin: Style.marginS
                  anchors.rightMargin: Style.marginS
                  spacing: Style.marginS

                  NIcon {
                    icon: groupSurface.expanded ? "chevron-down" : "chevron-right"
                    pointSize: Style.fontSizeL
                  }

                  NText {
                    Layout.fillWidth: true
                    text: groupSurface.modelData.name
                    pointSize: Style.fontSizeL
                    font.weight: Style.fontWeightSemiBold
                  }

                  NText {
                    visible: groupSurface.modifiedCount > 0
                    text: groupSurface.modifiedCount + " modified"
                    pointSize: Style.fontSizeS
                    color: Color.mOnSurfaceVariant
                    opacity: 0.7
                  }

                  NIconButton {
                    visible: groupSurface.modifiedCount > 0
                    baseSize: Style.baseWidgetSize * 0.65
                    icon: "restore"
                    tooltipText: "Reset section"
                    onClicked: root.resetGroup(groupSurface.groupParams)
                  }
                }
              }

              ColumnLayout {
                visible: groupSurface.quick || groupSurface.expanded
                Layout.fillWidth: true
                spacing: Style.marginS

                RowLayout {
                  visible: groupSurface.modelData.name === "Diagnostics"
                  Layout.fillWidth: true

                  NToggle {
                    label: "Preview"
                    description: "Show an isolated glass sample"
                    checked: root.previewVisible
                    onToggled: function(checked) {
                      root.previewVisible = checked;
                      if (checked) root.updatePreview();
                      else root.client.hidePreview();
                    }
                  }

                  NToggle {
                    visible: root.previewVisible
                    enabled: root.previewVisible
                    label: "Diagnostic background"
                    description: "Use a neutral grid instead of wallpaper"
                    checked: root.diagnosticBackground
                    onToggled: function(checked) {
                      root.diagnosticBackground = checked;
                      root.updatePreview();
                    }
                  }
                }

                Repeater {
                  model: groupSurface.groupParams

                  ParamControl {
                    required property var modelData

                    Layout.fillWidth: true
                    param: modelData
                    client: root.client
                    screen: root.pluginApi ? root.pluginApi.panelOpenScreen : null
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
