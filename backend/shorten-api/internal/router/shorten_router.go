package router

import (
	"shorten-api/internal/controller"
	middleware "shorten-api/internal/middlware"
	"shorten-api/internal/repository"
	"shorten-api/internal/service"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func RegisterShortenRoutes(rg *gin.RouterGroup, db *gorm.DB, rdb *redis.Client) {
	shortenUrlRepository := repository.NewShortenUrlRepository(db)
	shortenUrlService := service.NewShortenUrlService(*shortenUrlRepository, rdb)
	shortenController := controller.NewShortenController(*shortenUrlService)
	r := rg.Group("/shorten")
	r.GET("/:shortenCode", shortenController.GetOriginalUrl) // Public access to redirect

	// Protected routes
	r.Use(middleware.AuthMiddleware())
	r.POST("/create", shortenController.CreateShortenUrl)
	r.PUT("/update/:id", shortenController.UpdateShortenUrl)
	r.GET("/list", shortenController.GetListShortenUrl)
	r.DELETE("/:shortenCode", shortenController.DeleteShortenUrl)
}
