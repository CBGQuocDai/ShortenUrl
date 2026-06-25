package middleware

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type UserResponse struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type ApiResponse struct {
	Data UserResponse `json:"data"`
}

var ssoApiUrl string

func init() {
	ssoHost := os.Getenv("SSO_API_HOST")
	if ssoHost == "" {
		// Use docker service name as default or localized testing
		ssoHost = "http://localhost:8080"
	}
	ssoApiUrl = ssoHost + "/auth/me"
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is missing"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if !(len(parts) == 2 && parts[0] == "Bearer") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header format must be Bearer {token}"})
			c.Abort()
			return
		}

		req, err := http.NewRequest(http.MethodGet, ssoApiUrl, nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create request to SSO service"})
			c.Abort()
			return
		}

		req.Header.Set("Authorization", authHeader)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Failed to connect to SSO service"})
			c.Abort()
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Token is invalid or expired"})
			c.Abort()
			return
		}

		var apiResp ApiResponse
		if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse SSO response"})
			c.Abort()
			return
		}

		// Set context variable for next handlers
		c.Set("userId", apiResp.Data.ID)
		c.Set("username", apiResp.Data.Username)
		c.Set("role", apiResp.Data.Role)

		c.Next()
	}
}
