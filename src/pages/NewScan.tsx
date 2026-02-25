import { ScanForm } from "@/components/ScanForm";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/components/PageTransition";
import spectraLogo from "@/assets/spectra-logo.png";

const NewScan = () => {
  return (
    <motion.div
      className="flex flex-col items-center justify-center gap-8 py-16"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      <motion.div variants={fadeInUp} className="flex flex-col items-center gap-4 text-center">
        <motion.img
          src={spectraLogo}
          alt="ThreatLens"
          className="h-12 w-12 rounded-xl"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
        <h1 className="text-2xl font-bold">New Reconnaissance Scan</h1>
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          Enter a target domain or URL to perform automated attack surface mapping and threat intelligence analysis.
        </p>
      </motion.div>
      <motion.div variants={fadeInUp}>
        <ScanForm />
      </motion.div>
      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full mt-4">
        {[
          { title: "Surface Mapping", desc: "Discover endpoints, JS files, forms, and external dependencies" },
          { title: "Vuln Detection", desc: "Identify missing headers, exposed paths, and injection points" },
          { title: "AI Report", desc: "Get an AI-generated threat intelligence report with remediations" },
        ].map((item, i) => (
          <motion.div
            key={item.title}
            className="p-5 rounded-xl bg-card border border-border text-center card-hover"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.08, duration: 0.3 }}
          >
            <div className="text-sm font-semibold text-foreground mb-1.5">{item.title}</div>
            <div className="text-xs text-muted-foreground leading-relaxed">{item.desc}</div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default NewScan;
