package config

import (
	"log/slog"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func ConnectMySQL() *gorm.DB {
	dsn := "root:12345@tcp(100.89.19.104:3306)/shorten_url?charset=utf8mb4&parseTime=True&loc=Local"
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		panic("failed to connect database")
	}
	slog.Info("Connected to MySQL database")
	return db
}

// func ConnectRedis() *gorm.DB {

// }
