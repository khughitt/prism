import QtQuick
import qs.Commons

Item {
  property var pluginApi: null

  property bool allowAttach: true
  property real contentPreferredWidth: 360
  property real contentPreferredHeight: 240

  Text {
    anchors.centerIn: parent
    color: Color.mOnSurface
    text: "prism"
  }
}
