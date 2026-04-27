package main

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// Local library scanning is separated from playlists and recents to keep filesystem code isolated.
func (s *CloudPlayerService) ListLocalSongs() ([]LocalSongRow, error) {
	rows, err := s.state.DB.Query(`
		SELECT id, title, artist, file_path
		FROM songs
		ORDER BY title COLLATE NOCASE, id ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []LocalSongRow
	for rows.Next() {
		var row LocalSongRow
		if err := rows.Scan(&row.ID, &row.Title, &row.Artist, &row.FilePath); err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func (s *CloudPlayerService) ScanMusicFolder(path string) (ScanMusicFolderResult, error) {
	absolute, err := filepath.Abs(strings.TrimSpace(path))
	if err != nil {
		return ScanMusicFolderResult{}, err
	}
	info, err := os.Stat(absolute)
	if err != nil {
		return ScanMusicFolderResult{}, err
	}
	if !info.IsDir() {
		return ScanMusicFolderResult{}, fmt.Errorf("不是有效的文件夹路径")
	}

	result := ScanMusicFolderResult{}
	err = filepath.WalkDir(absolute, func(current string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(entry.Name())), ".")
		if !isAudioExtension(ext) {
			return nil
		}
		result.AudioFilesSeen++

		title := strings.TrimSpace(strings.TrimSuffix(entry.Name(), filepath.Ext(entry.Name())))
		if title == "" {
			title = current
		}
		execResult, err := s.state.DB.Exec(`
			INSERT INTO songs (title, artist, album, file_path)
			VALUES (?, '', '', ?)
			ON CONFLICT(file_path) DO UPDATE SET title = excluded.title
		`, title, current)
		if err != nil {
			return nil
		}
		if changed, err := execResult.RowsAffected(); err == nil {
			result.RowsWritten += int(changed)
		}
		return nil
	})
	if err != nil {
		return ScanMusicFolderResult{}, err
	}
	return result, nil
}
