package cloudplayer

import "database/sql"

// execRowsAffected keeps repair SQL counting consistent without repeating Result handling everywhere.
func execRowsAffected(tx *sql.Tx, query string, args ...any) (int64, error) {
	result, err := tx.Exec(query, args...)
	if err != nil {
		return 0, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	return affected, nil
}
