package auth

import (
	"context"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Config struct {
	JWTSecret       string
	TokenTTL        time.Duration
	RefreshTokenTTL time.Duration
}

type Service struct {
	cfg Config
	db  *pgxpool.Pool
}

func NewService(cfg Config, db *pgxpool.Pool) *Service {
	return &Service{cfg: cfg, db: db}
}

type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int64  `json:"expires_in"` // seconds
}

type claims struct {
	UserID string `json:"sub"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// Register creates a new user and returns a token pair.
func (s *Service) Register(ctx context.Context, email, password string) (*TokenPair, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("auth: hash password: %w", err)
	}

	var userID string
	err = s.db.QueryRow(ctx,
		`INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
		email, string(hash),
	).Scan(&userID)
	if err != nil {
		return nil, fmt.Errorf("auth: insert user: %w", err)
	}

	return s.issueTokens(userID, email)
}

// Login authenticates a user and returns a token pair.
func (s *Service) Login(ctx context.Context, email, password string) (*TokenPair, error) {
	var userID, passwordHash string
	err := s.db.QueryRow(ctx,
		`SELECT id, password_hash FROM users WHERE email = $1`,
		email,
	).Scan(&userID, &passwordHash)
	if err != nil {
		return nil, fmt.Errorf("auth: user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return nil, fmt.Errorf("auth: invalid credentials")
	}

	return s.issueTokens(userID, email)
}

// ValidateToken parses and validates an access token, returning the userID.
func (s *Service) ValidateToken(tokenStr string) (userID string, err error) {
	t, err := jwt.ParseWithClaims(tokenStr, &claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	})
	if err != nil {
		return "", fmt.Errorf("auth: invalid token: %w", err)
	}

	c, ok := t.Claims.(*claims)
	if !ok || !t.Valid {
		return "", fmt.Errorf("auth: invalid claims")
	}
	return c.UserID, nil
}

func (s *Service) issueTokens(userID, email string) (*TokenPair, error) {
	now := time.Now()

	accessClaims := &claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.TokenTTL)),
		},
	}
	access, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("auth: sign access token: %w", err)
	}

	refreshClaims := &claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        uuid.New().String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.cfg.RefreshTokenTTL)),
		},
	}
	refresh, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return nil, fmt.Errorf("auth: sign refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  access,
		RefreshToken: refresh,
		ExpiresIn:    int64(s.cfg.TokenTTL.Seconds()),
	}, nil
}
