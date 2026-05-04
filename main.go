package main

import (
	"embed"
	"log"

	"cloudplayer/backend/cloudplayer"
)

// Main wires embedded frontend assets into the backend app package.

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/trayicon_template_macos.png
var macTrayTemplateIcon []byte

func main() {
	if err := cloudplayer.Run(assets, macTrayTemplateIcon); err != nil {
		log.Fatal(err)
	}
}
