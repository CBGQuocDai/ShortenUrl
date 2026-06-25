package service

import (
	"context"
	"errors"
	"log/slog"
	"shorten-api/internal/dto"
	"shorten-api/internal/model"
	"shorten-api/internal/repository"
	"time"

	"github.com/redis/go-redis/v9"
)

type ShortenUrlService struct {
	shortenUrlRepository repository.ShortenUrlRepository
	rdb                  *redis.Client
}

func NewShortenUrlService(shortenUrlRepository repository.ShortenUrlRepository, rdb *redis.Client) *ShortenUrlService {
	return &ShortenUrlService{
		shortenUrlRepository: shortenUrlRepository,
		rdb:                  rdb,
	}
}

func (s *ShortenUrlService) CreateShortenUrl(req *dto.CreateShortenRequest, userId uint64) (*dto.ShortenUrlResponse, error) {
	if req.ShortenCode != "" {
		existing, err := s.shortenUrlRepository.GetUrlByShortenCode(req.ShortenCode)
		if err == nil && existing != nil {
			return nil, errors.New("short code already exists")
		}
	}

	slog.Info("Creating shortened URL for:", "url", req.Url, "code", req.ShortenCode)
	var url *model.ShortenUrl = &model.ShortenUrl{
		URL:       req.Url,
		ShortCode: req.ShortenCode,
		UserId:    userId,
	}
	err := s.shortenUrlRepository.CreateShortenUrl(url)
	if err != nil {
		slog.Error("Error creating shortened URL:", "err", err)
		return nil, err
	}

	// Cache the new url mapping
	ctx := context.Background()
	s.rdb.Set(ctx, "url:"+url.ShortCode, url.URL, 24*time.Hour)

	return &dto.ShortenUrlResponse{
		ID:          url.ID,
		Url:         url.URL,
		ShortCode:   url.ShortCode,
		AccessCount: url.AccessCount,
	}, nil
}

func (s *ShortenUrlService) UpdateShortenUrl(url *dto.CreateShortenRequest, id uint64, userId uint64) error {
	// Kiểm tra nếu có gửi shortCode mới thì nó có bị trùng với record khác không
	existing, err := s.shortenUrlRepository.GetUrlByShortenCode(url.ShortenCode)
	if err == nil && existing != nil && existing.ID != id {
		return errors.New("short code already exists")
	}

	shortenUrl := &model.ShortenUrl{
		ID:        id,
		URL:       url.Url,
		ShortCode: url.ShortenCode,
		UserId:    userId,
	}
	err = s.shortenUrlRepository.UpdateShortenUrl(shortenUrl)
	if err == nil {
		// Update cache
		ctx := context.Background()
		if existing != nil && existing.ShortCode != "" && existing.ShortCode != url.ShortenCode {
			s.rdb.Del(ctx, "url:"+existing.ShortCode)
		}
		if url.ShortenCode != "" {
			s.rdb.Set(ctx, "url:"+url.ShortenCode, url.Url, 24*time.Hour)
		}
	}
	return err
}

func (s *ShortenUrlService) GetListShortenUrl(page int, size int, userId uint64) ([]*dto.ShortenUrlResponse, error) {
	data, err := s.shortenUrlRepository.GetListShortenUrl(page, size, userId)
	if err != nil {
		slog.Error("Error getting list of shortened URLs:", "err", err)
		return nil, err
	}
	var response = make([]*dto.ShortenUrlResponse, 0, len(data))
	for _, shortenUrl := range data {
		response = append(response, &dto.ShortenUrlResponse{
			ID:          shortenUrl.ID,
			Url:         shortenUrl.URL,
			ShortCode:   shortenUrl.ShortCode,
			AccessCount: shortenUrl.AccessCount,
		})
	}
	return response, nil
}

func (s *ShortenUrlService) GetOriginalUrl(shortenCode string) (string, error) {
	ctx := context.Background()
	cachedUrl, err := s.rdb.Get(ctx, "url:"+shortenCode).Result()
	if err == nil && cachedUrl != "" {
		// Asynchronously update access count in DB
		go func() {
			data, _ := s.shortenUrlRepository.GetUrlByShortenCode(shortenCode)
			if data != nil {
				_ = s.shortenUrlRepository.UpdateAccessCount(data.ID)
			}
		}()
		return cachedUrl, nil
	}

	data, err := s.shortenUrlRepository.GetUrlByShortenCode(shortenCode)
	if err != nil {
		slog.Error("Error getting original URL:", "err", err)
		return "", err
	}
	if data != nil {
		err := s.shortenUrlRepository.UpdateAccessCount(data.ID)
		if err != nil {
			slog.Error("Error updating access count:", "err", err)
			return "", err
		}
		// Cache it for future access
		s.rdb.Set(ctx, "url:"+shortenCode, data.URL, 24*time.Hour)
		return data.URL, nil
	}
	return "", nil
}

func (s *ShortenUrlService) DeleteShortenUrl(shortenCode string, userId uint64) error {
	err := s.shortenUrlRepository.DeleteShortenUrlByShortenCode(shortenCode, userId)
	if err != nil {
		slog.Error("Error deleting shortened URL:", "err", err)
		return err
	}
	// Delete from cache
	s.rdb.Del(context.Background(), "url:"+shortenCode)
	return nil
}
