import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight } from "lucide-react";
import voxaLogo from "@/assets/voxa-logo.png";
import { registerOwnerBusiness } from "@/lib/api";

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    ownerName: "",
    ownerEmail: "",
    businessName: "",
    businessType: "",
    description: "",
    products: "",
    policies: "",
  });

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const handleNext = async () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Registration complete -> call backend
      try {
        const result = await registerOwnerBusiness({
          owner: { name: formData.ownerName, email: formData.ownerEmail },
          business: {
            name: formData.businessName,
            industry: formData.businessType,
            description: formData.description,
            products: formData.products.split(",").map((s) => s.trim()).filter(Boolean),
            policies: formData.policies,
          },
        });
        localStorage.setItem("voxa_token", result.token || "");
        localStorage.setItem("voxa_business_id", result.businessId || "");
        navigate("/dashboard");
      } catch (e) {
        // eslint-disable-next-line no-alert
        alert("Registration failed");
      }
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleChange = (field: string, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <img src={voxaLogo} alt="Voxa" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Welcome to Voxa
          </h1>
          <p className="text-muted-foreground mt-2">Let's set up your AI assistant</p>
        </div>

        {/* Progress bar */}
        <div className="mb-8">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground mt-2 text-center">
            Step {step} of {totalSteps}
          </p>
        </div>

        {/* Form card */}
        <div className="glass rounded-2xl p-8 shadow-lg animate-slide-up border-2 border-transparent bg-gradient-to-r from-primary/20 to-accent/20">
          <div className="space-y-6">
            {step === 1 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Owner Information</h2>
                <div>
                  <Label htmlFor="ownerName">Full Name</Label>
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) => handleChange("ownerName", e.target.value)}
                    placeholder="John Doe"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="ownerEmail">Email Address</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => handleChange("ownerEmail", e.target.value)}
                    placeholder="john@example.com"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Business Information</h2>
                <div>
                  <Label htmlFor="businessName">Business Name</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => handleChange("businessName", e.target.value)}
                    placeholder="Acme Corp"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="businessType">Business Type</Label>
                  <Input
                    id="businessType"
                    value={formData.businessType}
                    onChange={(e) => handleChange("businessType", e.target.value)}
                    placeholder="E-commerce, SaaS, etc."
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Business Description</h2>
                <div>
                  <Label htmlFor="description">Tell us about your business</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="We provide premium cloud solutions for small businesses..."
                    className="mt-1 min-h-32"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Products & Services</h2>
                <div>
                  <Label htmlFor="products">List your main products or services</Label>
                  <Textarea
                    id="products"
                    value={formData.products}
                    onChange={(e) => handleChange("products", e.target.value)}
                    placeholder="Cloud hosting, Website builder, Email marketing..."
                    className="mt-1 min-h-32"
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4 animate-fade-in">
                <h2 className="text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Policies & Guidelines</h2>
                <div>
                  <Label htmlFor="policies">Company policies and guidelines</Label>
                  <Textarea
                    id="policies"
                    value={formData.policies}
                    onChange={(e) => handleChange("policies", e.target.value)}
                    placeholder="Refund policy, support hours, terms of service..."
                    className="mt-1 min-h-32"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <Button onClick={handleNext} className="gap-2">
              {step === totalSteps ? "Complete" : "Next"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
