import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Privacy = () => {
    const navigate = useNavigate();
    return (
        <div className="px-5 pt-4 pb-8 space-y-5">
            <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass grid place-items-center">
                <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">Privacy Policy</h1>
            <div className="glass rounded-2xl p-5 shadow-card space-y-4 text-sm text-foreground leading-relaxed">
                <p className="font-semibold">Data We Collect</p>
                <p>
                    When you create an account, we store your email address and display name. When you scan products, we store your scan history (barcode, product name, health score) linked to your account.
                </p>
                <p className="font-semibold">How We Use Your Data</p>
                <ul className="space-y-1 pl-4">
                    <li>• Authentication and account management</li>
                    <li>• Storing your scan history and saved items</li>
                    <li>• Improving the product database</li>
                </ul>
                <p className="font-semibold">Third-Party Services</p>
                <ul className="space-y-1 pl-4">
                    <li>• <strong>Supabase</strong> — Authentication and database hosting</li>
                    <li>• <strong>Google Gemini</strong> — AI-powered ingredient analysis (ingredient text is sent to Google's API)</li>
                    <li>• <strong>Open Food Facts</strong> — Product data lookup</li>
                </ul>
                <p className="font-semibold">Data Security</p>
                <p>
                    Your data is stored securely using Supabase with Row Level Security (RLS) policies. Each user can only access their own scan history and saved items. API keys and secrets are stored server-side only.
                </p>
                <p className="font-semibold">Data Deletion</p>
                <p>
                    You can delete your scan history and saved items at any time from within the app. To delete your account entirely, contact us or use the Supabase dashboard.
                </p>
                <p className="font-semibold">Camera and Image Access</p>
                <p>
                    Ingredia requests camera access solely for barcode scanning. Images captured for OCR analysis are processed on our server and are not stored permanently. No images are shared with third parties except Google Gemini for ingredient extraction when Tesseract OCR fails.
                </p>
                <p className="text-muted-foreground text-xs pt-2">
                    Last updated: May 2026
                </p>
            </div>
        </div>
    );
};

export default Privacy;
