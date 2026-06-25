package main

import (
	"log"
	"shorten-api/internal/config"
	"shorten-api/internal/model"
	"shorten-api/internal/router"
)

func main() {
	var port string = "4000"
	db := config.ConnectMySQL()
	db.AutoMigrate(&model.ShortenUrl{})

	rdb := config.ConnectRedis()
	r := router.SetupRouter(db, rdb)
	if err := r.Run(":" + port); err != nil {
		log.Fatal(err)
	}
}
