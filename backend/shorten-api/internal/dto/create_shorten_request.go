package dto

type CreateShortenRequest struct {
	Url         string `json:"url" validate:"required,url"`
	ShortenCode string `json:"shorten_code" validate:"omitempty"`
}
