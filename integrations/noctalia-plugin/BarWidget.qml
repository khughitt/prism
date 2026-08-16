import QtQuick
import Quickshell
import qs.Commons
import qs.Services.UI
import qs.Widgets

NIconButton {
  id: root

  property ShellScreen screen
  property var pluginApi: null

  property string widgetId: ""
  property string section: ""
  property int sectionWidgetIndex: -1
  property int sectionWidgetsCount: 0

  baseSize: Style.getCapsuleHeightForScreen(screen?.name)
  applyUiScale: false
  customRadius: Style.radiusL
  icon: "wand"
  tooltipText: "Prism"
  tooltipDirection: BarService.getTooltipDirection(screen?.name)
  colorBg: Style.capsuleColor
  colorFg: Color.mOnSurface
  colorBgHover: Color.mHover
  colorFgHover: Color.mOnHover
  colorBorder: "transparent"
  colorBorderHover: "transparent"
  border.color: Style.capsuleBorderColor
  border.width: Style.capsuleBorderWidth

  onClicked: {
    if (pluginApi) {
      pluginApi.togglePanel(screen, root)
    }
  }
}
