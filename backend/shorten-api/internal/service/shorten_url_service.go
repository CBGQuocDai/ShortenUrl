package service

import (
	"context"
	"errors"
	"log/slog"
	"shorten-api/internal/dto"
	"shorten-api/internal/model"
	"shorten-api/internal/repository"
	"strconv"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type ShortenUrlService struct {
	shortenUrlRepository *repository.ShortenUrlRepository
	rdb                  *redis.Client
	clicks               chan uint64
	idCache              sync.Map
}

func NewShortenUrlService(shortenUrlRepository *repository.ShortenUrlRepository, rdb *redis.Client) *ShortenUrlService {
	s := &ShortenUrlService{
		shortenUrlRepository: shortenUrlRepository,
		rdb:                  rdb,
		clicks:               make(chan uint64, 100000),
	}
	go s.flushAccessCounts()
	return s
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
	s.rdb.Set(ctx, "url_id:"+url.ShortCode, url.ID, 24*time.Hour)
	s.idCache.Store(url.ShortCode, url.ID)

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
		s.queueAccessCount(ctx, shortenCode, 0)
		return cachedUrl, nil
	}

	data, err := s.shortenUrlRepository.GetUrlByShortenCode(shortenCode)
	if err != nil {
		slog.Error("Error getting original URL:", "err", err)
		return "", err
	}
	if data != nil {
		// Cache it for future access
		s.rdb.Set(ctx, "url:"+shortenCode, data.URL, 24*time.Hour)
		s.rdb.Set(ctx, "url_id:"+shortenCode, data.ID, 24*time.Hour)
		s.idCache.Store(shortenCode, data.ID)
		s.queueAccessCount(ctx, shortenCode, data.ID)
		return data.URL, nil
	}
	return "", nil
}

func (s *ShortenUrlService) queueAccessCount(ctx context.Context, shortenCode string, id uint64) {
	if id == 0 {
		if cachedID, ok := s.idCache.Load(shortenCode); ok {
			if parsedID, ok := cachedID.(uint64); ok {
				id = parsedID
			}
		}
	}

	if id == 0 {
		cachedID, err := s.rdb.Get(ctx, "url_id:"+shortenCode).Result()
		if err == nil && cachedID != "" {
			parsedID, parseErr := strconv.ParseUint(cachedID, 10, 64)
			if parseErr == nil {
				id = parsedID
				s.idCache.Store(shortenCode, id)
			}
		}
	}

	if id == 0 {
		data, err := s.shortenUrlRepository.GetUrlByShortenCode(shortenCode)
		if err != nil || data == nil {
			if err != nil {
				slog.Error("Error getting URL for access count update:", "err", err)
			}
			return
		}
		id = data.ID
		s.rdb.Set(ctx, "url_id:"+shortenCode, id, 24*time.Hour)
		s.idCache.Store(shortenCode, id)
	}

	select {
	case s.clicks <- id:
	default:
		slog.Warn("Access count queue is full; dropping click", "shortenCode", shortenCode)
	}
}

func (s *ShortenUrlService) flushAccessCounts() {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	counts := make(map[uint64]uint64)
	flush := func() {
		if len(counts) == 0 {
			return
		}

		batch := make(map[uint64]uint64, len(counts))
		for id, count := range counts {
			batch[id] = count
			delete(counts, id)
		}

		if err := s.shortenUrlRepository.UpdateAccessCounts(batch); err != nil {
			slog.Error("Error flushing access counts:", "err", err)
		}
	}

	for {
		select {
		case id := <-s.clicks:
			counts[id]++
			if len(counts) >= 1000 {
				flush()
			}
		case <-ticker.C:
			flush()
		}
	}
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
