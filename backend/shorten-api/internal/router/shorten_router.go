package router

import (
	"shorten-api/internal/controller"
	"shorten-api/internal/repository"
	"shorten-api/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func RegisterShortenRoutes(rg *gin.RouterGroup, db *gorm.DB) {
	shortenUrlRepository := repository.NewShortenUrlRepository(db)
	shortenUrlService := service.NewShortenUrlService(*shortenUrlRepository)
	shortenController := controller.NewShortenController(*shortenUrlService)
	r := rg.Group("/shorten")
	r.POST("/create", shortenController.CreateShortenUrl)
	r.PUT("/update/:id", shortenController.UpdateShortenUrl)
	r.GET("/list", shortenController.GetListShortenUrl)
	r.GET("/:shortenCode", shortenController.GetOriginalUrl)
	r.DELETE("/:shortenCode", shortenController.DeleteShortenUrl)
}
