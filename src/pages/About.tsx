import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const About = () => {
    const navigate = useNavigate();
    return (
        <div className="px-5 pt-4 pb-8 space-y-5">
            <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full glass grid place-items-center">
                <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold text-foreground">About Ingredia</h1>
            <div className="glass rounded-2xl p-5 shadow-card space-y-4 text-sm text-foreground leading-relaxed">
                <p>
                    Ingredia is an AI-powered food ingredient analysis platform designed to help Indian consumers make informed choices about packaged food products.
                </p>
                <p>
                    India's packaged food market is growing rapidly, but most consumers struggle to understand ingredient labels. Complex chemical names, E-numbers, and fine print make it nearly impossible to quickly assess whether a product is healthy.
                </p>
                <p>
                    Ingredia bridges this gap. Point your phone camera at any packaged food barcode, and within seconds you get a clear breakdown of every ingredient — color-coded by risk level, scored for overall health impact, and explained in plain language by AI.
                </p>
                <p className="font-semibold">Key Features:</p>
                <ul className="space-y-1 pl-4">
                    <li>• Real-time barcode scanning (EAN-13, UPC-A)</li>
                    <li>• OCR-based ingredient extraction from labels</li>
                    <li>• Deterministic health scoring (0-100)</li>
                    <li>• AI-powered ingredient explanations</li>
                    <li>• Safer alternative recommendations</li>
                    <li>• Scan history and bookmarks</li>
                </ul>
                <p className="text-muted-foreground text-xs pt-2">
                    Version 1.0.0 · Built as a Final Year Major Project
                </p>
            </div>
        </div>
    );
};

export default About;
