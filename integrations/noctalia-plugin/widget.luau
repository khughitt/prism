barWidget.setGlyph("wand")
barWidget.setTooltip("Prism")

function onClick()
  local output = barWidget.outputName()
  noctalia.state.set("originOutput", output)
  noctalia.togglePanel("khughitt/prism:panel")
end
