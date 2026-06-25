package service

import (
	"errors"
	"log/slog"
	"shorten-api/internal/dto"
	"shorten-api/internal/model"
	"shorten-api/internal/repository"
)

type ShortenUrlService struct {
	shortenUrlRepository repository.ShortenUrlRepository
}

func NewShortenUrlService(shortenUrlRepository repository.ShortenUrlRepository) *ShortenUrlService {
	return &ShortenUrlService{
		shortenUrlRepository: shortenUrlRepository,
	}
}

func (s *ShortenUrlService) CreateShortenUrl(req *dto.CreateShortenRequest) (*dto.ShortenUrlResponse, error) {
	if req.ShortenCode != "" {
		existing, err := s.shortenUrlRepository.GetUrlByShortenCode(req.ShortenCode)
		if err == nil && existing != nil {
			return nil, errors.New("short code already exists")
		}
	}

	slog.Info("Creating shortened URL for:", req.Url, "with code:", req.ShortenCode)
	var url *model.ShortenUrl = &model.ShortenUrl{
		URL:       req.Url,
		ShortCode: req.ShortenCode,
	}
	err := s.shortenUrlRepository.CreateShortenUrl(url)
	if err != nil {
		slog.Error("Error creating shortened URL:", err)
		return nil, err
	}

	return &dto.ShortenUrlResponse{
		ID:          url.ID,
		Url:         url.URL,
		ShortCode:   url.ShortCode,
		AccessCount: url.AccessCount,
	}, nil
}

func (s *ShortenUrlService) UpdateShortenUrl(url *dto.CreateShortenRequest, id uint64) error {
	// Kiểm tra nếu có gửi shortCode mới thì nó có bị trùng với record khác không
	existing, err := s.shortenUrlRepository.GetUrlByShortenCode(url.ShortenCode)
	if err == nil && existing != nil && existing.ID != id {
		return errors.New("short code already exists")
	}

	shortenUrl := &model.ShortenUrl{
		ID:        id,
		URL:       url.Url,
		ShortCode: url.ShortenCode,
	}
	err = s.shortenUrlRepository.UpdateShortenUrl(shortenUrl)
	return err
}

func (s *ShortenUrlService) GetListShortenUrl(page int, size int) ([]*dto.ShortenUrlResponse, error) {
	data, err := s.shortenUrlRepository.GetListShortenUrl(page, size)
	if err != nil {
		slog.Error("Error getting list of shortened URLs:", err)
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
	data, err := s.shortenUrlRepository.GetUrlByShortenCode(shortenCode)
	if err != nil {
		slog.Error("Error getting original URL:", err)
		return "", err
	}
	if data != nil {
		err := s.shortenUrlRepository.UpdateAccessCount(data.ID)
		if err != nil {
			slog.Error("Error updating access count:", err)
			return "", err
		}
		return data.URL, nil
	}
	return "", nil
}

func (s *ShortenUrlService) DeleteShortenUrl(shortenCode string) error {

	err := s.shortenUrlRepository.DeleteShortenUrlByShortenCode(shortenCode)
	if err != nil {
		slog.Error("Error deleting shortened URL:", err)
		return err
	}

	return nil
}
