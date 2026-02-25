import { ScanForm } from "@/components/ScanForm";
import spectraLogo from "@/assets/spectra-logo.png";

const NewScan = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16">
      <div className="flex flex-col items-center gap-4 text-center">
        <img src={spectraLogo} alt="Spectra" className="h-12 w-12 rounded-xl" />
        <h1 className="text-2xl font-bold">New Reconnaissance Scan</h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Enter a target domain or URL to perform automated attack surface mapping and threat intelligence analysis.
        </p>
      </div>
      <ScanForm />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mt-4">
        {[
          { title: "Surface Mapping", desc: "Discover endpoints, JS files, forms, and external dependencies" },
          { title: "Vuln Detection", desc: "Identify missing headers, exposed paths, and injection points" },
          { title: "AI Report", desc: "Get an AI-generated threat intelligence report with remediations" },
        ].map(item => (
          <div key={item.title} className="p-5 rounded-xl bg-card border border-border text-center card-hover">
            <div className="text-sm font-semibold text-foreground mb-1.5">{item.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewScan;
