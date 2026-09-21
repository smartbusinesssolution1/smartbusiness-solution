//We attach custom properties to the Request object
// in our middleware (user, workspace, permissions, requestId).
// TypeScript needs to know about these properties.
declare namespace Express {
    interface Request {
        // unique request identifier for tracing
        requestId: string

        // authenticated user ( set by auth middleware )
        user?: {
            userId: string;
            tenantId: string;
            email: string
        }

        //current workspace context( set by workspace middleware)

        workspace?: {
            id: string;
            tenantId: string;
            businessName: string;
        }

        // users permission in the current workspace

        permissions?: {
            isSuperUser: boolean;
            canCreate: boolean;
            canPrint: boolean;
            canApprove: boolean
        }
    }
}