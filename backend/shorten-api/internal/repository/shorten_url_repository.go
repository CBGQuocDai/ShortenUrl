package repository

import (
	"shorten-api/internal/model"

	"gorm.io/gorm"
)

type ShortenUrlRepository struct {
	db *gorm.DB
}

func NewShortenUrlRepository(db *gorm.DB) *ShortenUrlRepository {
	return &ShortenUrlRepository{
		db: db,
	}
}

func (r *ShortenUrlRepository) CreateShortenUrl(shortenUrl *model.ShortenUrl) error {
	return r.db.Create(shortenUrl).Error
}

func (r *ShortenUrlRepository) GetUrlByShortenCode(shortenCode string) (*model.ShortenUrl, error) {
	var shortenUrl model.ShortenUrl
	err := r.db.Where("short_code = ?", shortenCode).First(&shortenUrl).Error
	if err != nil {
		return nil, err
	}
	return &shortenUrl, nil
}
func (r *ShortenUrlRepository) GetListShortenUrl(page int, size int) ([]*model.ShortenUrl, error) {
	var shortenUrls []*model.ShortenUrl
	offset := (page - 1) * size
	err := r.db.Offset(offset).Limit(size).Find(&shortenUrls).Error
	if err != nil {
		return nil, err
	}
	return shortenUrls, nil
}

func (r *ShortenUrlRepository) UpdateShortenUrl(shortenUrl *model.ShortenUrl) error {
	updates := map[string]interface{}{
		"url": shortenUrl.URL,
	}

	// Chỉ update short_code nếu có gửi trong request
	if shortenUrl.ShortCode != "" {
		updates["short_code"] = shortenUrl.ShortCode
	}

	err := r.db.Model(&model.ShortenUrl{}).Where("id = ?", shortenUrl.ID).Updates(updates).Error
	if err != nil {
		return err
	}
	return nil
}

func (r *ShortenUrlRepository) UpdateAccessCount(id uint64) error {
	return r.db.Model(&model.ShortenUrl{}).Where("ID = ?", id).Update("access_count", gorm.Expr("access_count + 1")).Error
}

func (r *ShortenUrlRepository) DeleteShortenUrlByShortenCode(shortenCode string) error {
	return r.db.Where("short_code = ?", shortenCode).Delete(&model.ShortenUrl{}).Error
}
