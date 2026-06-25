package main

import (
	"log"
	"shorten-api/internal/config"
	"shorten-api/internal/router"
)

func main() {
	var port string = "4000"
	db := config.ConnectMySQL()
	r := router.SetupRouter(db)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
