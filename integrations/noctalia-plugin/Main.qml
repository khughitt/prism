import QtQuick

Item {
  id: root

  property var pluginApi: null
  property alias client: prismClient

  PrismClient {
    id: prismClient
  }
}
