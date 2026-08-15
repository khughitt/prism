import QtQuick
import Quickshell.Io

Item {
  id: root

  signal described(var model)
  signal drained
  signal failed(string message)

  function refresh() {
    if (!describeProcess.running) {
      describeProcess.running = true;
    }
  }

  // Task 18 replaces these visible failures with the serialized write queue.
  function set(key, value, isSample) {
    failed("Prism writes are not available yet.");
  }

  function unset(key) {
    failed("Prism writes are not available yet.");
  }

  Process {
    id: describeProcess

    command: ["prism", "describe", "--json"]
    stdout: StdioCollector {}
    stderr: StdioCollector {}

    onExited: function(exitCode) {
      var output = String(describeProcess.stdout.text || "");
      var errorText = String(describeProcess.stderr.text || "").trim();

      if (exitCode !== 0) {
        root.failed(errorText || "prism describe exited " + exitCode);
        return;
      }

      try {
        var model = JSON.parse(output);
        if (!model || !Array.isArray(model.params)) {
          throw new Error("prism describe returned an invalid model");
        }
        root.described(model);
      } catch (error) {
        root.failed(error && error.message ? error.message : "Failed to parse prism describe output.");
      }
    }
  }
}
