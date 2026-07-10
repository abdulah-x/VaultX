"""
Database Backup and Restore API Endpoints
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from services.backup_service import backup_service
from core.dependencies import require_admin, get_db
from core.audit import log_audit_event
from database.models import User

router = APIRouter(prefix="/api/backup", tags=["Backup & Restore"])


class BackupRequest(BaseModel):
    backup_name: Optional[str] = None


class RestoreRequest(BaseModel):
    backup_file: str


class CleanupRequest(BaseModel):
    keep_last_n: int = 30


class BackupResponse(BaseModel):
    success: bool
    message: str
    data: dict


@router.post("/create", response_model=BackupResponse)
async def create_backup(
    request: BackupRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new database backup

    - **backup_name**: Optional custom name for the backup

    Returns backup information including file path and size
    """
    try:
        result = backup_service.create_backup(request.backup_name)

        # Schedule auto-cleanup in background
        background_tasks.add_task(backup_service.auto_cleanup, 30)

        log_audit_event(db, current_user.id, "backup_create", f"Backup created by '{current_user.username}'",
                         entity_type="backup", success=True)

        return BackupResponse(
            success=True,
            message="Backup created successfully",
            data=result
        )
    except Exception as e:
        log_audit_event(db, current_user.id, "backup_create", f"Backup creation failed for '{current_user.username}'",
                         entity_type="backup", success=False, error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Backup failed: {str(e)}")


@router.get("/list", response_model=BackupResponse)
async def list_backups(current_user: User = Depends(require_admin)):
    """
    List all available database backups
    
    Returns list of backups with metadata including filename, size, and creation date
    """
    try:
        backups = backup_service.list_backups()
        
        return BackupResponse(
            success=True,
            message=f"Found {len(backups)} backup(s)",
            data={"backups": backups, "count": len(backups)}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list backups: {str(e)}")


@router.post("/restore", response_model=BackupResponse)
async def restore_backup(
    request: RestoreRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Restore database from a backup file

    - **backup_file**: Name of the backup file to restore

    ⚠️ WARNING: This will replace the current database!
    A pre-restore backup will be created automatically.
    """
    try:
        result = backup_service.restore_backup(request.backup_file)

        log_audit_event(db, current_user.id, "backup_restore",
                         f"Database restored from '{request.backup_file}' by '{current_user.username}'",
                         entity_type="backup", success=True)

        return BackupResponse(
            success=True,
            message="Database restored successfully. Please restart the application.",
            data=result
        )
    except FileNotFoundError as e:
        log_audit_event(db, current_user.id, "backup_restore",
                         f"Restore failed for '{current_user.username}': file not found",
                         entity_type="backup", success=False, error_message=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log_audit_event(db, current_user.id, "backup_restore", f"Restore failed for '{current_user.username}'",
                         entity_type="backup", success=False, error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Restore failed: {str(e)}")


@router.delete("/delete/{backup_file}", response_model=BackupResponse)
async def delete_backup(
    backup_file: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Delete a specific backup file

    - **backup_file**: Name of the backup file to delete
    """
    try:
        result = backup_service.delete_backup(backup_file)

        log_audit_event(db, current_user.id, "backup_delete",
                         f"Backup '{backup_file}' deleted by '{current_user.username}'",
                         entity_type="backup", success=True)

        return BackupResponse(
            success=True,
            message="Backup deleted successfully",
            data=result
        )
    except FileNotFoundError as e:
        log_audit_event(db, current_user.id, "backup_delete",
                         f"Delete failed for '{current_user.username}': file not found",
                         entity_type="backup", success=False, error_message=str(e))
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log_audit_event(db, current_user.id, "backup_delete", f"Delete failed for '{current_user.username}'",
                         entity_type="backup", success=False, error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


@router.post("/cleanup", response_model=BackupResponse)
async def cleanup_old_backups(
    request: CleanupRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Clean up old backups, keeping only the most recent N backups

    - **keep_last_n**: Number of recent backups to keep (default: 30)
    """
    try:
        result = backup_service.auto_cleanup(request.keep_last_n)

        log_audit_event(db, current_user.id, "backup_cleanup",
                         f"Backup cleanup by '{current_user.username}' (keep_last_n={request.keep_last_n})",
                         entity_type="backup", success=True)

        return BackupResponse(
            success=True,
            message=result["message"],
            data=result
        )
    except Exception as e:
        log_audit_event(db, current_user.id, "backup_cleanup", f"Backup cleanup failed for '{current_user.username}'",
                         entity_type="backup", success=False, error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")


@router.get("/info", response_model=BackupResponse)
async def get_database_info(current_user: User = Depends(require_admin)):
    """
    Get information about the current database
    
    Returns database type, location, size, and other relevant information
    """
    try:
        info = backup_service.get_database_info()
        
        return BackupResponse(
            success=True,
            message="Database information retrieved",
            data=info
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get database info: {str(e)}")


@router.post("/auto-backup", response_model=BackupResponse)
async def auto_backup(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create an automatic daily backup

    This endpoint can be called by a scheduled task (cron job, Task Scheduler, etc.)
    to perform automatic daily backups
    """
    try:
        timestamp = datetime.now().strftime("%Y%m%d")
        result = backup_service.create_backup(f"daily_{timestamp}")

        # Clean up old backups (keep last 30)
        background_tasks.add_task(backup_service.auto_cleanup, 30)

        log_audit_event(db, current_user.id, "backup_auto",
                         f"Automatic backup created by '{current_user.username}'",
                         entity_type="backup", success=True)

        return BackupResponse(
            success=True,
            message="Automatic backup created successfully",
            data=result
        )
    except Exception as e:
        log_audit_event(db, current_user.id, "backup_auto", f"Automatic backup failed for '{current_user.username}'",
                         entity_type="backup", success=False, error_message=str(e))
        raise HTTPException(status_code=500, detail=f"Auto-backup failed: {str(e)}")
