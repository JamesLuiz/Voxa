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
    ownerPassword: "",
    businessName: "",
    businessType: "",
    description: "",
    products: "",
    policies: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});

  const totalSteps = 5;
  const progress = (step / totalSteps) * 100;

  const handleNext = async () => {
    // Validate current step before moving forward
    const stepValid = validateStep(step);
    if (!stepValid) return;

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
    // Clear error for this field when user types
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validateEmail = (email: string) => {
    // simple email regex
    return /^\S+@\S+\.\S+$/.test(email);
  };

  const validatePassword = (pw: string) => {
    // at least one uppercase and one lowercase and min 8 chars
    return /[A-Z]/.test(pw) && /[a-z]/.test(pw) && pw.length >= 8;
  };

  const validateStep = (s: number) => {
    const newErrors: { [k: string]: string } = {};
    if (s === 1) {
      if (!formData.ownerName.trim()) newErrors.ownerName = "Required";
      if (!formData.ownerEmail.trim()) newErrors.ownerEmail = "Required";
      else if (!validateEmail(formData.ownerEmail)) newErrors.ownerEmail = "Enter a valid email";
      if (!formData.ownerPassword) newErrors.ownerPassword = "Required";
      else if (!validatePassword(formData.ownerPassword)) newErrors.ownerPassword = "Password must be at least 8 characters and include upper and lower case letters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isCurrentStepValid = () => {
    // quick non-destructive check for disabling button
    if (step === 1) {
      return (
        formData.ownerName.trim() &&
        validateEmail(formData.ownerEmail) &&
        validatePassword(formData.ownerPassword)
      );
    }
    // For other steps, require non-empty required fields
    if (step === 2) return formData.businessName.trim() && formData.businessType.trim();
    return true;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 md:p-6 bg-background">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8 animate-fade-in">
          <img src={voxaLogo} alt="Voxa" className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4" />
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent px-4">
            Welcome to Voxa
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 px-4">Let's set up your AI assistant</p>
        </div>

        {/* Progress bar */}
        <div className="mb-6 sm:mb-8 px-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs sm:text-sm text-muted-foreground mt-2 text-center">
            Step {step} of {totalSteps}
          </p>
        </div>

        {/* Form card */}
        <div className="glass rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 shadow-lg animate-slide-up border-2 border-transparent bg-gradient-to-r from-primary/20 to-accent/20">
          <div className="space-y-4 sm:space-y-6">
            {step === 1 && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <h2 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Owner Information</h2>
                <div>
                  <Label htmlFor="ownerName" className="text-sm sm:text-base">Full Name</Label>
                  <Input
                    id="ownerName"
                    value={formData.ownerName}
                    onChange={(e) => handleChange("ownerName", e.target.value)}
                    placeholder="John Doe"
                    className="mt-1 text-sm sm:text-base h-10 sm:h-11"
                  />
                  {errors.ownerName && <p className="text-xs sm:text-sm text-destructive mt-1">{errors.ownerName}</p>}
                </div>
                <div>
                  <Label htmlFor="ownerEmail" className="text-sm sm:text-base">Email Address</Label>
                  <Input
                    id="ownerEmail"
                    type="email"
                    value={formData.ownerEmail}
                    onChange={(e) => handleChange("ownerEmail", e.target.value)}
                    placeholder="john@example.com"
                    className="mt-1 text-sm sm:text-base h-10 sm:h-11"
                  />
                  {errors.ownerEmail && <p className="text-xs sm:text-sm text-destructive mt-1">{errors.ownerEmail}</p>}
                </div>
                <div>
                  <Label htmlFor="ownerPassword" className="text-sm sm:text-base">Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="ownerPassword"
                      type={showPassword ? "text" : "password"}
                      value={formData.ownerPassword}
                      onChange={(e) => handleChange("ownerPassword", e.target.value)}
                      placeholder="At least 8 characters"
                      className="pr-16 sm:pr-20 text-sm sm:text-base h-10 sm:h-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 text-xs sm:text-sm text-muted-foreground px-2"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  {errors.ownerPassword && <p className="text-xs sm:text-sm text-destructive mt-1">{errors.ownerPassword}</p>}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <h2 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Business Information</h2>
                <div>
                  <Label htmlFor="businessName" className="text-sm sm:text-base">Business Name</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => handleChange("businessName", e.target.value)}
                    placeholder="Acme Corp"
                    className="mt-1 text-sm sm:text-base h-10 sm:h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="businessType" className="text-sm sm:text-base">Business Type</Label>
                  <Input
                    id="businessType"
                    value={formData.businessType}
                    onChange={(e) => handleChange("businessType", e.target.value)}
                    placeholder="E-commerce, SaaS, etc."
                    className="mt-1 text-sm sm:text-base h-10 sm:h-11"
                  />
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <h2 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Business Description</h2>
                <div>
                  <Label htmlFor="description" className="text-sm sm:text-base">Tell us about your business</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleChange("description", e.target.value)}
                    placeholder="We provide premium cloud solutions for small businesses..."
                    className="mt-1 min-h-28 sm:min-h-32 text-sm sm:text-base"
                  />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <h2 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Products & Services</h2>
                <div>
                  <Label htmlFor="products" className="text-sm sm:text-base">List your main products or services</Label>
                  <Textarea
                    id="products"
                    value={formData.products}
                    onChange={(e) => handleChange("products", e.target.value)}
                    placeholder="Cloud hosting, Website builder, Email marketing..."
                    className="mt-1 min-h-28 sm:min-h-32 text-sm sm:text-base"
                  />
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <h2 className="text-xl sm:text-2xl font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Policies & Guidelines</h2>
                <div>
                  <Label htmlFor="policies" className="text-sm sm:text-base">Company policies and guidelines</Label>
                  <Textarea
                    id="policies"
                    value={formData.policies}
                    onChange={(e) => handleChange("policies", e.target.value)}
                    placeholder="Refund policy, support hours, terms of service..."
                    className="mt-1 min-h-28 sm:min-h-32 text-sm sm:text-base"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row justify-between mt-6 sm:mt-8 gap-2 sm:gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
              className="gap-2 h-10 sm:h-11 text-sm sm:text-base w-full sm:w-auto"
            >
              <ArrowLeft className="w-3 h-3 sm:w-4 sm:h-4" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              className="gap-2 h-10 sm:h-11 text-sm sm:text-base w-full sm:w-auto"
              disabled={!isCurrentStepValid()}
            >
              {step === totalSteps ? "Complete" : "Next"}
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;