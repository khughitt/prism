import QtQuick
import Quickshell.Io
import "./queue.mjs" as Queue

Item {
  id: root

  signal described(var model)
  signal drained
  signal failed(string message)

  property var queue: Queue.newQueue()
  property string errorMessage: ""
  property string writeError: ""
  property bool refreshPending: false

  function refresh() {
    if (describeProcess.running) {
      refreshPending = true;
      return;
    }
    describeProcess.running = true;
  }

  function finishRefresh() {
    if (refreshPending) {
      refreshPending = false;
      describeProcess.running = true;
    }
  }

  function set(key, value, isSample) {
    push({ verb: "set", key: key, value: value, sample: isSample });
  }

  function unset(key) {
    push({ verb: "unset", key: key });
  }

  function push(item) {
    if (queue.inFlight === null) {
      writeError = "";
      errorMessage = "";
    }

    var result = Queue.enqueue(queue, item);
    queue = result.state;
    if (result.launch) {
      launch(result.launch);
    }
  }

  function launch(item) {
    writeProcess.command = Queue.argvFor(item);
    writeProcess.running = true;
  }

  function writeDone(exitCode, errorText) {
    if (exitCode !== 0) {
      writeError = errorText || "prism exited " + exitCode;
      errorMessage = writeError;
      failed(writeError);
    }

    var result = Queue.finish(queue);
    queue = result.state;
    if (result.launch) {
      launch(result.launch);
    } else if (result.drained) {
      drained();
      refresh();
    }
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
        var message = errorText || "prism describe exited " + exitCode;
        if (root.writeError === "") {
          root.errorMessage = message;
        }
        root.failed(message);
      } else {
        try {
          var model = JSON.parse(output);
          if (!model || !Array.isArray(model.params)) {
            throw new Error("prism describe returned an invalid model");
          }
          root.errorMessage = root.writeError;
          root.described(model);
        } catch (error) {
          var message = error && error.message ? error.message : "Failed to parse prism describe output.";
          if (root.writeError === "") {
            root.errorMessage = message;
          }
          root.failed(message);
        }
      }

      root.finishRefresh();
    }
  }

  Process {
    id: writeProcess

    stdout: StdioCollector {}
    stderr: StdioCollector {}

    onExited: function(exitCode) {
      root.writeDone(exitCode, String(writeProcess.stderr.text || "").trim());
    }
  }
}
