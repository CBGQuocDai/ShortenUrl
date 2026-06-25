package dto

type ShortenUrlResponse struct {
	ID          uint64 `json:"id"`
	Url         string `json:"url"`
	ShortCode   string `json:"short_code"`
	AccessCount uint64 `json:"access_count"`
}
