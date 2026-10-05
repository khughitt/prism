// The prism-key-to-native-node map a sink declares in its manifest: which
// `ParamSpec.node` (the renderer's spelling, "noise type=") a key writes. Keys
// with no native node (bypass toggles, tint source, ring keys that write
// response fields) are absent. The rack loader uses it to check that a
// device's keys are owned by the device's stage.
export function nodeMap(manifests) {
  const nodes = new Map();
  for (const manifest of manifests) {
    for (const bind of manifest.binds) {
      if (bind.node === undefined) continue;
      const prior = nodes.get(bind.param);
      if (prior !== undefined && prior !== bind.node) {
        throw new Error(`${bind.param} binds two nodes: ${prior} and ${bind.node}`);
      }
      nodes.set(bind.param, bind.node);
    }
  }
  return nodes;
}
