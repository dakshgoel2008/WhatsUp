import { z } from "zod";

export const validate = (schema) => (req, res, next) => {
    try {
        schema.parse({
            body: req.body,
            query: req.query,
            params: req.params,
        });
        next();
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error("Zod Validation Failed:", JSON.stringify(err.errors, null, 2));
            console.error("Incoming req.body:", req.body);
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: err.errors,
            });
        }
        next(err);
    }
};

export const messageSchema = z.object({
    body: z.object({
        text: z.string().max(2000, "Message is too long").optional(),
    }).optional(),
    params: z.object({
        id: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid user ID"),
    }),
});

export const signupSchema = z.object({
    body: z.object({
        name: z.string().min(2, "Name must be at least 2 characters").max(50),
        email: z.string().email("Invalid email address"),
        password: z.string().min(6, "Password must be at least 6 characters"),
        username: z.string().min(3, "Username must be at least 3 characters").max(30),
    }),
});

export const loginSchema = z.object({
    body: z.object({
        email: z.string().email("Invalid email address").optional(),
        username: z.string().min(3).optional(),
        password: z.string().min(1, "Password is required"),
    }).refine(data => data.email || data.username, {
        message: "Either email or username must be provided"
    }),
});
