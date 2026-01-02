"use client"

import Link from "next/link"
import {
  CheckCircle2,
  Target,
  Brain,
  Dumbbell,
  Users,
  BarChart3,
  Sparkles,
  Calendar,
  Repeat,
  Trophy,
  ArrowRight,
  Briefcase,
  Heart,
  Inbox,
  Timer,
  MessageSquare,
  Flame,
  Footprints,
  Eye,
  BookOpen,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl">Zadaniomat</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Zaloguj się</Button>
            </Link>
            <Link href="/register">
              <Button>Rozpocznij</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 text-blue-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Wspierany przez AI
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            Twoje zadania, nawyki i cele
            <span className="text-blue-500"> w jednym miejscu</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Inteligentny system do zarządzania pracą i życiem prywatnym.
            Planuj zadania, buduj nawyki, śledź postępy i osiągaj cele z pomocą AI.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="gap-2 text-lg px-8">
                Wypróbuj za darmo
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-lg px-8">
                Mam już konto
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Workspaces Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Dwa światy, jeden system</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Rozdziel pracę od życia prywatnego. Każda przestrzeń ma dedykowane narzędzia.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Work Workspace */}
            <Card className="p-8 border-2 hover:border-blue-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Przestrzeń Pracy</h3>
                  <p className="text-muted-foreground text-sm">Produktywność na najwyższym poziomie</p>
                </div>
              </div>
              <ul className="space-y-3">
                <FeatureItem icon={CheckCircle2} text="Zarządzanie zadaniami z backlogiem" />
                <FeatureItem icon={Target} text="Cele i sprinty projektowe" />
                <FeatureItem icon={Calendar} text="Harmonogram i kalendarz" />
                <FeatureItem icon={Repeat} text="Zadania cykliczne" />
                <FeatureItem icon={Brain} text="Asystent AI do planowania" />
                <FeatureItem icon={BarChart3} text="Statystyki i retrospektywy" />
              </ul>
            </Card>

            {/* Private Workspace */}
            <Card className="p-8 border-2 hover:border-pink-500/50 transition-colors">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-pink-500/10 rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-pink-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Przestrzeń Prywatna</h3>
                  <p className="text-muted-foreground text-sm">Rozwój osobisty i zdrowie</p>
                </div>
              </div>
              <ul className="space-y-3">
                <FeatureItem icon={CheckCircle2} text="Śledzenie nawyków ze smugami" />
                <FeatureItem icon={Trophy} text="Wyzwania z celami" />
                <FeatureItem icon={Dumbbell} text="Trening i aktywność fizyczna" />
                <FeatureItem icon={Target} text="Cele fitness" />
                <FeatureItem icon={Users} text="Aktywność znajomych" />
                <FeatureItem icon={BarChart3} text="Postępy i statystyki" />
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Wszystko czego potrzebujesz</h2>
            <p className="text-muted-foreground text-lg">
              Kompleksowe narzędzia do produktywności i rozwoju osobistego
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Brain}
              title="Asystent AI"
              description="Inteligentne planowanie, sugestie zadań i retrospektywy wspierane przez sztuczną inteligencję"
            />
            <FeatureCard
              icon={Target}
              title="Cele i sprinty"
              description="Definiuj cele, dziel je na mniejsze zadania i realizuj w sprintach"
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Nawyki"
              description="Buduj pozytywne nawyki z codziennym, tygodniowym lub miesięcznym śledzeniem"
            />
            <FeatureCard
              icon={Trophy}
              title="Grywalizacja"
              description="Zdobywaj XP, awansuj na wyższe poziomy i odblokowuj osiągnięcia"
            />
            <FeatureCard
              icon={Dumbbell}
              title="Fitness"
              description="Śledź treningi, kroki i postępy w celach fitness"
            />
            <FeatureCard
              icon={BarChart3}
              title="Statystyki"
              description="Szczegółowe analizy produktywności i postępów w czasie"
            />
          </div>
        </div>
      </section>

      {/* Detailed Guide */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Jak korzystać z Zadaniomatu?</h2>
            <p className="text-muted-foreground text-lg">
              Szczegółowa instrukcja krok po kroku dla każdej przestrzeni
            </p>
          </div>

          <div className="space-y-12">
            {/* Work Guide */}
            <Card className="p-8 border-2 border-blue-500/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Przestrzeń Pracy</h3>
                  <p className="text-muted-foreground">Planowanie projektów i zadań</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <GuideStep
                    icon={Timer}
                    title="1. Ustaw okresy i sprinty"
                    description="W zakładce Sprinty stwórz dłuższe 3-miesięczne okresy planowania. W ramach okresów dodawaj 2-tygodniowe sprinty do realizacji konkretnych zadań."
                  />
                  <GuideStep
                    icon={Target}
                    title="2. Zdefiniuj cele"
                    description="W zakładce Cele określ co chcesz osiągnąć w danym okresie i sprincie. Cele pomagają skupić się na tym co najważniejsze."
                  />
                  <GuideStep
                    icon={Inbox}
                    title="3. Zapisuj pomysły w Backlogu"
                    description="Masz pomysł? Wrzuć go szybko do Backlogu. To miejsce na wszystkie zadania czekające na realizację."
                  />
                </div>
                <div className="space-y-6">
                  <GuideStep
                    icon={MessageSquare}
                    title="4. Rozmawiaj z AI"
                    description="Asystent AI ma dostęp do Twoich notatek i bazy wiedzy. Zderzaj z nim pomysły, planuj zadania. Z poziomu chatu możesz tworzyć zadania i cele."
                  />
                  <GuideStep
                    icon={Calendar}
                    title="5. Planuj w harmonogramie"
                    description="Układaj zadania w harmonogramie dnia. Śledź ile czasu spędzasz na poszczególnych zadaniach."
                  />
                  <GuideStep
                    icon={BookOpen}
                    title="6. Buduj bazę wiedzy"
                    description="Zapisuj notatki, procedury i wiedzę w dedykowanej zakładce. AI wykorzysta je przy planowaniu."
                  />
                </div>
              </div>
            </Card>

            {/* Private Guide */}
            <Card className="p-8 border-2 border-pink-500/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-pink-500 rounded-xl flex items-center justify-center">
                  <Heart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Przestrzeń Prywatna</h3>
                  <p className="text-muted-foreground">Nawyki, wyzwania i aktywność</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <GuideStep
                    icon={Repeat}
                    title="1. Dodaj codzienne nawyki"
                    description="Stwórz listę nawyków które chcesz budować - czytanie, medytacja, ćwiczenia. System śledzi Twoje smugi i motywuje do regularności."
                  />
                  <GuideStep
                    icon={Flame}
                    title="2. Podejmij wyzwania"
                    description="Wyzwania to cele z różną częstotliwością: 3x w tygodniu gotowanie w domu, comiesięczne odkładanie na oszczędności, czy tygodniowe cele treningowe."
                  />
                </div>
                <div className="space-y-6">
                  <GuideStep
                    icon={Dumbbell}
                    title="3. Śledź aktywność sportową"
                    description="Zapisuj treningi w zakładce Sport. Ćwiczysz na siłowni? Możesz zapisać jakie partie mięśni trenowałeś danego dnia."
                  />
                  <GuideStep
                    icon={Footprints}
                    title="4. Monitoruj kroki"
                    description="W zakładce Kroki zapisuj dzienną aktywność. Obserwuj trendy i motywuj się do większego ruchu."
                  />
                </div>
              </div>
            </Card>

            {/* Friends Guide */}
            <Card className="p-8 border-2 border-primary/30">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Znajomi</h3>
                  <p className="text-muted-foreground">Motywacja przez społeczność</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <GuideStep
                  icon={Eye}
                  title="Śledź postępy znajomych"
                  description="W zakładce Znajomi możesz sprawdzić jakie postępy zrobili Twoi znajomi w ostatnim czasie. Ich nawyki, wyzwania i aktywności sportowe."
                />
                <GuideStep
                  icon={Users}
                  title="Oznacz swoje aktywności jako publiczne"
                  description="Chcesz podzielić się postępami? Oznacz wybrane nawyki lub wyzwania jako widoczne dla innych. Motywujcie się nawzajem!"
                />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Gotowy na lepszą produktywność?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Dołącz do Zadaniomatu i zacznij osiągać swoje cele już dziś.
          </p>
          <Link href="/register">
            <Button size="lg" className="gap-2 text-lg px-10 py-6">
              Rozpocznij za darmo
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold">Zadaniomat AI</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Inteligentny system zarządzania zadaniami
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureItem({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
      <span>{text}</span>
    </li>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <Card className="p-6 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-blue-500" />
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </Card>
  )
}

function GuideStep({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <div className="flex gap-4">
      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-5 h-5 text-muted-foreground" />
      </div>
      <div>
        <h4 className="font-semibold mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
