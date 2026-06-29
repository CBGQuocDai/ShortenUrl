package controller

import (
	"shorten-api/internal/dto"
	"shorten-api/internal/service"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ShortenController struct {
	shortenService *service.ShortenUrlService
}

func NewShortenController(shortenService *service.ShortenUrlService) *ShortenController {
	return &ShortenController{
		shortenService: shortenService,
	}
}

func (c *ShortenController) CreateShortenUrl(ctx *gin.Context) {
	userIdContext := ctx.MustGet("userId").(int64)
	userId := uint64(userIdContext)
	var req dto.CreateShortenRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(400, gin.H{"message": "invalid request", "error": err.Error()})
		return
	}
	data, err := c.shortenService.CreateShortenUrl(&req, userId)
	if err != nil {
		ctx.JSON(400, gin.H{"message": "error creating shortened URL", "error": err.Error()})
		return
	}
	ctx.JSON(200, gin.H{
		"message": "created",
		"data":    data,
	})

}

func (c *ShortenController) GetOriginalUrl(ctx *gin.Context) {
	shortenCode := ctx.Param("shortenCode")

	data, err := c.shortenService.GetOriginalUrl(shortenCode)
	if err != nil {
		ctx.JSON(400, gin.H{"message": "error getting original URL", "error": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{
		"message": "success",
		"data":    data,
	})
}

func (c *ShortenController) UpdateShortenUrl(ctx *gin.Context) {
	userIdContext := ctx.MustGet("userId").(int64)
	userId := uint64(userIdContext)
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		ctx.JSON(400, gin.H{"message": "invalid id parameter", "error": err.Error()})
		return
	}

	var req dto.CreateShortenRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(400, gin.H{"message": "invalid request", "error": err.Error()})
		return
	}

	err = c.shortenService.UpdateShortenUrl(&req, id, userId)
	if err != nil {
		ctx.JSON(400, gin.H{"message": "error updating shortened URL", "error": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{
		"message": "updated",
	})
}

func (c *ShortenController) GetListShortenUrl(ctx *gin.Context) {
	userIdContext := ctx.MustGet("userId").(int64)
	userId := uint64(userIdContext)
	pageStr := ctx.DefaultQuery("page", "1")
	sizeStr := ctx.DefaultQuery("size", "10")

	page, err1 := strconv.Atoi(pageStr)
	size, err2 := strconv.Atoi(sizeStr)

	if err1 != nil || err2 != nil {
		ctx.JSON(400, gin.H{"message": "invalid page or size parameters"})
		return
	}

	data, err := c.shortenService.GetListShortenUrl(page, size, userId)
	if err != nil {
		ctx.JSON(400, gin.H{"message": "error getting list of shortened URLs", "error": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{
		"message": "success",
		"data":    data,
	})
}

func (c *ShortenController) DeleteShortenUrl(ctx *gin.Context) {
	userIdContext := ctx.MustGet("userId").(int64)
	userId := uint64(userIdContext)
	shortenCode := ctx.Param("shortenCode")
	if shortenCode == "" {
		ctx.JSON(400, gin.H{"message": "missing shortenCode parameter"})
		return
	}

	err := c.shortenService.DeleteShortenUrl(shortenCode, userId)
	if err != nil {
		ctx.JSON(400, gin.H{"message": "error deleting shortened URL", "error": err.Error()})
		return
	}

	ctx.JSON(200, gin.H{
		"message": "deleted",
	})
}
