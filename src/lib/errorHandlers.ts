import { auth } from './firebase';

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'list' | 'get' | 'delete';
  path: string;
  authInfo: {
    userId: string | null;
    email: string | null;
    emailVerified: boolean;
  }
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string): string {
  if (error?.message?.includes('insufficient permissions')) {
    const errorInfo: FirestoreErrorInfo = {
      error: error.message,
      operationType,
      path,
      authInfo: {
        userId: auth.currentUser?.uid || null,
        email: auth.currentUser?.email || null,
        emailVerified: auth.currentUser?.emailVerified || false,
      }
    };
    
    console.error("Firestore Permission Denied:", errorInfo);
    return `Security Policy Restriction: You do not have permission to ${operationType} this record. Please contact your administrator.`;
  }
  
  return error?.message || "An unexpected error occurred while saving the record.";
}
