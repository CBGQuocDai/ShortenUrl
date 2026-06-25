package model

// create table ShortenUrl (
//     id BIGINT primary key auto_increment,
//     short_code varchar(255) unique ,
//     url varchar(255) not null ,
// #     user_id long not null
//     created_at timestamp default current_timestamp,
//     updated_at timestamp default current_timestamp on update current_timestamp,
//     access_count BIGINT default 0
// )

import "time"

type ShortenUrl struct {
	ID          uint64    `gorm:"column:id;primaryKey;autoIncrement" json:"id"`
	ShortCode   string    `gorm:"column:short_code;type:varchar(255);unique" json:"short_code"`
	URL         string    `gorm:"column:url;type:varchar(255);not null" json:"url"`
	CreatedAt   time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at" json:"updated_at"`
	AccessCount uint64    `gorm:"column:access_count;default:0" json:"access_count"`
}

func (ShortenUrl) TableName() string {
	return "ShortenUrl"
}
