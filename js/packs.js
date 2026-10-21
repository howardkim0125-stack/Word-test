/* ============================================================
 * packs.js — 추천 단어팩 (수능·모의고사 빈출 어휘)
 *  - 수능·학력평가 영어 지문에 자주 나오는 어휘를 품사/주제별로 묶은 목록
 *  - 특정 회차 시험지에서 자동 추출한 것은 아님 (회차 정보 없음)
 *  - words는 일괄 등록과 같은 "word - 뜻, 뜻" 형식
 * ============================================================ */

const WORD_PACKS = [
  {
    id: 'csat-verbs',
    name: '수능 빈출 동사',
    desc: '독해 지문에 자주 나오는 핵심 동사',
    color: 0,
    words: `
abandon - 버리다, 포기하다
absorb - 흡수하다, 몰두시키다
accelerate - 가속하다, 촉진하다
accommodate - 수용하다, 숙박시키다, 적응시키다
accompany - 동반하다, 동행하다
accumulate - 축적하다, 모으다
acknowledge - 인정하다, 감사를 표하다
acquire - 얻다, 습득하다
adapt - 적응하다, 각색하다
adjust - 조정하다, 적응하다
admire - 감탄하다, 존경하다
adopt - 채택하다, 입양하다
advocate - 옹호하다, 지지하다, 옹호자
allocate - 할당하다, 배분하다
alter - 바꾸다, 변경하다
anticipate - 예상하다, 기대하다
appreciate - 감사하다, 감상하다, 진가를 알아보다
approve - 승인하다, 찬성하다
arise - 생기다, 발생하다
assess - 평가하다
assign - 할당하다, 배정하다
assume - 가정하다, 떠맡다
attain - 달성하다, 이루다
attribute - 탓으로 돌리다, 속성
bear - 견디다, 낳다, 지니다
cease - 멈추다, 중단되다
claim - 주장하다, 요구하다, 주장
coincide - 동시에 일어나다, 일치하다
collaborate - 협력하다
compensate - 보상하다, 보충하다
compete - 경쟁하다
comply - 따르다, 준수하다
compose - 구성하다, 작곡하다
comprehend - 이해하다
conceal - 숨기다
concentrate - 집중하다
conclude - 결론짓다, 끝내다
conduct - 수행하다, 지휘하다, 행동
confirm - 확인하다, 확정하다
confront - 직면하다, 맞서다
constitute - 구성하다, 이루다
consume - 소비하다, 먹다
contemplate - 숙고하다, 고려하다
contradict - 반박하다, 모순되다
contribute - 기여하다, 기부하다
convey - 전달하다, 운반하다
convince - 확신시키다, 설득하다
cooperate - 협력하다
cultivate - 경작하다, 기르다, 함양하다
decline - 감소하다, 거절하다, 감소
dedicate - 바치다, 헌신하다
deny - 부인하다, 거부하다
depict - 묘사하다, 그리다
deprive - 빼앗다, 박탈하다
derive - 얻다, 유래하다
deserve - ~할 만하다, ~을 받을 자격이 있다
detect - 감지하다, 발견하다
deteriorate - 악화되다
determine - 결정하다, 알아내다
devote - 바치다, 헌신하다
diminish - 줄어들다, 감소시키다
disclose - 드러내다, 밝히다
discourage - 낙담시키다, 단념시키다
dismiss - 묵살하다, 해고하다, 무시하다
distinguish - 구별하다
distort - 왜곡하다
distract - 산만하게 하다, 주의를 딴 데로 돌리다
dominate - 지배하다, 우세하다
eliminate - 제거하다, 없애다
embrace - 포용하다, 받아들이다, 껴안다
emerge - 나타나다, 드러나다
emphasize - 강조하다
enable - 가능하게 하다
encounter - 마주치다, 맞닥뜨리다, 만남
endure - 견디다, 지속되다
enhance - 향상시키다, 높이다
ensure - 보장하다, 확실하게 하다
establish - 설립하다, 확립하다
evaluate - 평가하다
evolve - 진화하다, 발전하다
exaggerate - 과장하다
exceed - 초과하다, 넘다
exclude - 제외하다, 배제하다
exhibit - 보이다, 전시하다, 전시품
expand - 확장하다, 팽창하다
exploit - 이용하다, 착취하다
facilitate - 촉진하다, 용이하게 하다
foster - 기르다, 촉진하다, 육성하다
generate - 생성하다, 발생시키다
grasp - 붙잡다, 이해하다, 파악하다
hinder - 방해하다
identify - 확인하다, 식별하다, 동일시하다
ignore - 무시하다
illustrate - 설명하다, 보여주다, 삽화를 넣다
imply - 암시하다, 의미하다
impose - 부과하다, 강요하다
indicate - 나타내다, 가리키다
induce - 유도하다, 유발하다
infer - 추론하다
inhibit - 억제하다, 방해하다
interpret - 해석하다, 통역하다
intervene - 개입하다, 중재하다
invest - 투자하다
involve - 포함하다, 관련시키다, 수반하다
maintain - 유지하다, 주장하다
manipulate - 조작하다, 다루다
modify - 수정하다, 변경하다
neglect - 무시하다, 소홀히 하다, 방치
observe - 관찰하다, 준수하다
obtain - 얻다, 획득하다
occupy - 차지하다, 점령하다
overcome - 극복하다
overlook - 간과하다, 내려다보다
perceive - 인식하다, 지각하다
persist - 지속되다, 고집하다
persuade - 설득하다
possess - 소유하다, 지니다
precede - 앞서다, 선행하다
predict - 예측하다
preserve - 보존하다, 보호하다
prevail - 우세하다, 널리 퍼지다
prohibit - 금지하다
promote - 촉진하다, 승진시키다, 홍보하다
pursue - 추구하다, 뒤쫓다
recognize - 인식하다, 알아보다, 인정하다
regulate - 규제하다, 조절하다
reinforce - 강화하다
reject - 거절하다, 거부하다
release - 풀어주다, 방출하다, 발표하다
rely - 의존하다, 신뢰하다
replace - 대체하다, 교체하다
represent - 나타내다, 대표하다
resemble - 닮다
resist - 저항하다, 견디다
resolve - 해결하다, 결심하다
restore - 회복시키다, 복원하다
restrict - 제한하다
retain - 유지하다, 보유하다
reveal - 드러내다, 밝히다
sacrifice - 희생하다, 희생
stimulate - 자극하다, 활성화하다
substitute - 대체하다, 대용품
surpass - 능가하다, 넘어서다
suspend - 중단하다, 매달다, 정학시키다
sustain - 지속하다, 유지하다, 떠받치다
transform - 변형시키다, 바꾸다
undergo - 겪다, 받다
undermine - 약화시키다, 손상시키다
utilize - 이용하다, 활용하다
violate - 위반하다, 침해하다
withdraw - 철회하다, 물러나다, 인출하다
yield - 산출하다, 양보하다, 굴복하다
`
  },
  {
    id: 'csat-nouns',
    name: '수능 빈출 명사',
    desc: '주제·요지 문제에 자주 나오는 개념 명사',
    color: 1,
    words: `
access - 접근, 이용, 접근하다
account - 설명, 계좌, 설명하다
advantage - 이점, 장점
agriculture - 농업
alternative - 대안, 대체의
ancestor - 조상
anxiety - 불안, 걱정
approach - 접근법, 다가가다, 접근하다
aspect - 측면, 양상
assumption - 가정, 추정
atmosphere - 대기, 분위기
attitude - 태도
authority - 권위, 권한, 당국
behavior - 행동, 행위
belief - 믿음, 신념
bias - 편견, 편향
burden - 부담, 짐
capacity - 용량, 능력, 수용력
characteristic - 특징, 특유의
circumstance - 상황, 환경
civilization - 문명
cognition - 인지
community - 공동체, 지역 사회
component - 구성 요소, 부품
concept - 개념
conflict - 갈등, 충돌, 상충하다
consequence - 결과, 중요성
conservation - 보존, 보호
consumption - 소비
context - 맥락, 문맥
contrast - 대조, 대조하다
convention - 관습, 관례, 대회
creature - 생물, 피조물
criterion - 기준
criticism - 비판, 비평
curiosity - 호기심
debate - 토론, 논쟁, 토론하다
democracy - 민주주의
density - 밀도
discipline - 규율, 훈련, 학문 분야
diversity - 다양성
domain - 영역, 분야
efficiency - 효율성
element - 요소, 원소
emotion - 감정
empathy - 공감
equality - 평등
evidence - 증거
evolution - 진화, 발전
expense - 비용, 지출
expertise - 전문 지식, 전문성
extinction - 멸종
factor - 요인, 요소
feature - 특징, 특집, 특징으로 하다
function - 기능, 작동하다
generation - 세대, 생성
gravity - 중력, 심각성
habitat - 서식지
hypothesis - 가설
identity - 정체성, 신원
impact - 영향, 충격, 영향을 주다
incentive - 동기, 장려책, 인센티브
income - 소득, 수입
individual - 개인, 개인의, 개별적인
infant - 유아, 아기
inequality - 불평등
influence - 영향, 영향을 주다
insight - 통찰력, 이해
instinct - 본능
institution - 기관, 제도
intention - 의도
interaction - 상호작용
intuition - 직관
landscape - 풍경, 경치, 지형
legislation - 법률, 입법
literacy - 읽고 쓰는 능력, 문해력
mechanism - 메커니즘, 기제, 장치
motivation - 동기 부여, 동기
narrative - 이야기, 서술, 이야기체의
necessity - 필요성, 필수품
norm - 규범, 표준
obstacle - 장애물
occupation - 직업, 점유
organism - 유기체, 생물
outcome - 결과
perception - 인식, 지각
perspective - 관점, 시각, 원근법
phenomenon - 현상
policy - 정책, 방침
pollution - 오염
population - 인구, 개체군
potential - 잠재력, 잠재적인
predator - 포식자
prejudice - 편견
principle - 원리, 원칙
priority - 우선순위, 우선 사항
property - 재산, 소유물, 속성
proportion - 비율, 부분, 균형
prospect - 전망, 가능성
psychology - 심리학, 심리
reputation - 명성, 평판
resource - 자원, 자료
response - 반응, 응답
revenue - 수익, 세입
reward - 보상, 보상하다
routine - 일과, 일상, 판에 박힌
sequence - 순서, 연속
species - 종, 종류
stereotype - 고정관념
strategy - 전략
substance - 물질, 실체, 본질
symptom - 증상
technique - 기술, 기법
tendency - 경향, 성향
territory - 영토, 영역
theory - 이론
threat - 위협
trait - 특성, 특징
transition - 전환, 변화, 이행
uncertainty - 불확실성
variable - 변수, 변하기 쉬운
vehicle - 차량, 수단, 매개체
welfare - 복지, 행복
`
  },
  {
    id: 'csat-adjectives',
    name: '수능 빈출 형용사·부사',
    desc: '빈칸·어휘 문제에 자주 나오는 형용사와 연결 부사',
    color: 2,
    words: `
abstract - 추상적인, 요약
absolute - 절대적인, 완전한
abundant - 풍부한
accurate - 정확한
adequate - 적절한, 충분한
aggressive - 공격적인, 적극적인
ambiguous - 애매한, 모호한
ample - 충분한, 넉넉한
apparent - 분명한, 겉보기의
appropriate - 적절한
arbitrary - 임의적인, 독단적인
artificial - 인공의, 인위적인
competent - 유능한, 능숙한
complex - 복잡한, 복합체
comprehensive - 포괄적인, 종합적인
considerable - 상당한
consistent - 일관된, 한결같은
constant - 끊임없는, 일정한
contemporary - 동시대의, 현대의
conventional - 관습적인, 전통적인
critical - 비판적인, 중요한, 결정적인
crucial - 중대한, 결정적인
curious - 호기심 많은, 이상한
deliberate - 의도적인, 신중한, 숙고하다
dense - 밀집한, 빽빽한
distinct - 뚜렷한, 별개의
diverse - 다양한
domestic - 국내의, 가정의
efficient - 효율적인
elaborate - 정교한, 공들인, 자세히 설명하다
eligible - 자격이 있는
enormous - 거대한, 막대한
essential - 필수적인, 본질적인
ethical - 윤리적인
evident - 분명한, 명백한
excessive - 과도한
explicit - 명시적인, 명백한
extraordinary - 비범한, 특별한
fertile - 비옥한, 생식력 있는
flexible - 유연한, 융통성 있는
fragile - 깨지기 쉬운, 연약한
frequent - 잦은, 빈번한
genuine - 진짜의, 진실한
hostile - 적대적인
identical - 동일한
immense - 막대한, 거대한
implicit - 암시적인, 내재된
inevitable - 불가피한
inherent - 내재하는, 고유의
initial - 처음의, 초기의
innate - 타고난, 선천적인
intense - 강렬한, 극심한
intrinsic - 본질적인, 고유한
irrelevant - 무관한, 상관없는
legitimate - 합법적인, 정당한
mature - 성숙한, 성숙하다
moderate - 적당한, 온건한
mutual - 상호의, 공동의
neutral - 중립적인
numerous - 수많은
objective - 객관적인, 목표
obvious - 명백한, 분명한
optimistic - 낙관적인
passive - 수동적인
permanent - 영구적인
pessimistic - 비관적인
plausible - 그럴듯한
precise - 정확한, 정밀한
primary - 주요한, 최초의, 초등의
primitive - 원시적인
profound - 심오한, 깊은
prominent - 저명한, 두드러진
rational - 이성적인, 합리적인
redundant - 불필요한, 중복되는
relevant - 관련 있는, 적절한
reluctant - 꺼리는, 마지못해 하는
remarkable - 주목할 만한, 놀라운
remote - 먼, 외딴, 원격의
rigid - 엄격한, 단단한
scarce - 부족한, 드문
sensitive - 민감한, 세심한
significant - 중요한, 상당한
sophisticated - 정교한, 세련된
spontaneous - 자발적인, 즉흥적인
stable - 안정된
subjective - 주관적인
subsequent - 그 다음의, 이후의
subtle - 미묘한, 섬세한
sufficient - 충분한
superficial - 피상적인, 표면의
temporary - 일시적인, 임시의
tremendous - 엄청난
ultimate - 궁극적인, 최종의
universal - 보편적인, 전 세계의
valid - 타당한, 유효한
vast - 방대한, 광대한
vital - 필수적인, 생명의, 활기찬
vulnerable - 취약한, 연약한
accordingly - 그에 따라, 따라서
approximately - 대략
consequently - 결과적으로
eventually - 결국, 마침내
gradually - 점차, 서서히
inevitably - 불가피하게, 필연적으로
merely - 단지, 그저
nevertheless - 그럼에도 불구하고
primarily - 주로, 첫째로
relatively - 비교적, 상대적으로
seemingly - 겉보기에는, 외관상
simultaneously - 동시에
thereby - 그렇게 함으로써, 그것에 의하여
virtually - 사실상, 거의
`
  },
  {
    id: 'csat-advanced',
    name: '수능 고난도 어휘',
    desc: '빈칸 추론·순서·삽입 지문에 나오는 상위권 어휘',
    color: 5,
    words: `
aesthetic - 미적인, 미학의
altruistic - 이타적인
analogy - 유추, 비유
anomaly - 이례, 변칙
autonomy - 자율성, 자치
coercion - 강압, 강제
coherent - 일관성 있는, 논리 정연한
complacent - 자기만족적인, 안주하는
conformity - 순응, 일치
conspicuous - 눈에 띄는, 두드러진
contingent - ~에 달린, 우발적인
counterintuitive - 직관에 반하는
cumulative - 누적되는
deficiency - 결핍, 부족
detrimental - 해로운
deviate - 벗어나다, 일탈하다
dichotomy - 이분법
diffuse - 확산시키다, 퍼뜨리다, 분산된
discern - 분별하다, 알아차리다
discrepancy - 불일치, 차이
disparity - 격차, 불균형
dogmatic - 독단적인
elicit - 이끌어내다
embed - 끼워 넣다, 내재시키다
empirical - 경험적인, 실증적인
endeavor - 노력, 노력하다
entity - 실체, 독립체
envision - 상상하다, 마음속에 그리다
erroneous - 잘못된
exemplify - 예시하다, 전형이 되다
fallacy - 오류, 잘못된 생각
feasible - 실현 가능한
heterogeneous - 이질적인
heuristic - 경험적 지식, 발견법, 발견적인
hierarchy - 계층, 위계
homogeneous - 동질의, 균질의
ideology - 이념, 이데올로기
immerse - 몰두시키다, 담그다
impair - 손상시키다, 약화시키다
impartial - 공정한, 편견 없는
inclination - 경향, 성향, 기울기
incorporate - 통합하다, 포함하다
indispensable - 필수적인, 없어서는 안 될
ingenious - 기발한, 독창적인
inherit - 물려받다, 상속하다
intricate - 복잡한, 뒤얽힌
mediate - 중재하다, 매개하다
meticulous - 꼼꼼한, 세심한
mitigate - 완화하다
notion - 개념, 생각
novelty - 새로움, 참신함
obsolete - 구식의, 쓸모없게 된
offset - 상쇄하다
omit - 생략하다, 빠뜨리다
oversee - 감독하다
paradigm - 패러다임, 전형
paradox - 역설
perpetuate - 영속시키다, 지속시키다
pragmatic - 실용적인
precursor - 선구자, 전조
predisposition - 성향, 경향
prerequisite - 전제 조건, 필수의
prevalent - 널리 퍼진, 만연한
proficiency - 능숙함, 숙달
proliferation - 확산, 급증
provoke - 유발하다, 화나게 하다
reciprocal - 상호적인, 호혜적인
reconcile - 조화시키다, 화해시키다
refute - 반박하다
render - 만들다, 제공하다, 표현하다
replicate - 복제하다, 반복하다
resilience - 회복력, 탄력성
retrieve - 되찾다, 회수하다, 검색하다
salient - 두드러진, 현저한
saturate - 포화시키다, 흠뻑 적시다
scrutiny - 정밀 조사, 감시
skeptical - 회의적인
solidarity - 연대, 결속
speculate - 추측하다, 투기하다
static - 정적인, 고정된
subordinate - 종속된, 하위의, 부하
supplement - 보충하다, 보충제
susceptible - 영향을 받기 쉬운, 민감한
tangible - 유형의, 실체적인, 만질 수 있는
tentative - 잠정적인, 머뭇거리는
trivial - 사소한, 하찮은
underlying - 근본적인, 밑에 있는
unprecedented - 전례 없는
vague - 모호한, 막연한
validate - 입증하다, 인증하다
versatile - 다재다능한, 다용도의
vicarious - 대리의, 간접적인
`
  },
  {
    id: 'csat-phrases',
    name: '수능 빈출 숙어',
    desc: '독해·어법에 자주 나오는 구동사와 연결 표현',
    color: 4,
    words: `
account for - 설명하다, 차지하다
as a result - 결과적으로
at the expense of - ~을 희생하여
be associated with - ~와 관련되다
be aware of - ~을 알다
be bound to - 반드시 ~하다
be capable of - ~할 수 있다
be engaged in - ~에 종사하다, ~에 참여하다
be exposed to - ~에 노출되다
be involved in - ~에 관련되다, ~에 참여하다
be likely to - ~할 것 같다
be responsible for - ~에 책임이 있다, ~의 원인이다
be subject to - ~의 대상이다, ~을 받기 쉽다
bring about - 초래하다, 일으키다
by contrast - 대조적으로
by means of - ~에 의하여, ~을 써서
call for - 요구하다, 필요로 하다
carry out - 수행하다, 실행하다
come across - 우연히 만나다, 이해되다
come up with - 생각해 내다, 제시하다
consist of - ~로 구성되다
contribute to - ~에 기여하다, ~의 원인이 되다
cope with - 대처하다, 극복하다
cut back on - 줄이다
deal with - 다루다, 처리하다
depend on - 의존하다, ~에 달려 있다
derive from - ~에서 유래하다, ~에서 얻다
dispose of - 처리하다, 없애다
figure out - 이해하다, 알아내다
for instance - 예를 들어
get rid of - 제거하다, 없애다
give rise to - 일으키다, 초래하다
give up - 포기하다
in addition - 게다가, 덧붙여
in charge of - ~을 맡고 있는, ~의 책임이 있는
in contrast - 대조적으로
in return - 보답으로, 대신에
in spite of - ~에도 불구하고
in terms of - ~의 관점에서, ~에 관하여
in the long run - 결국, 장기적으로
instead of - ~ 대신에
keep track of - ~을 기록하다, 파악하다
lead to - ~로 이어지다, 초래하다
look into - 조사하다, 들여다보다
make sense - 이해가 되다, 타당하다
make up - 구성하다, 만들어 내다, 화장하다
on behalf of - ~을 대신하여, ~을 대표하여
on the other hand - 반면에, 다른 한편으로는
participate in - ~에 참여하다
pay attention to - ~에 주의를 기울이다
point out - 지적하다
prior to - ~ 이전에
put off - 미루다, 연기하다
rather than - ~라기보다는, ~ 대신에
refer to - 언급하다, 참조하다, 가리키다
regardless of - ~에 상관없이
result from - ~에서 기인하다
result in - ~을 초래하다, ~로 끝나다
rule out - 배제하다, 제외하다
set aside - 따로 떼어 두다, 무시하다
stand for - 나타내다, 상징하다, 지지하다
stick to - 고수하다, 지키다
take advantage of - 이용하다
take into account - 고려하다
take part in - ~에 참여하다
take place - 일어나다, 개최되다
turn out - 판명되다, 밝혀지다
when it comes to - ~에 관해서라면
with respect to - ~에 관하여
`
  },
  {
    id: 'csat-confusing',
    name: '수능 혼동 어휘',
    desc: '어휘·어법 문제 단골, 철자가 비슷해 헷갈리는 단어',
    color: 7,
    words: `
adapt - 적응하다, 각색하다
adopt - 채택하다, 입양하다
adept - 능숙한
affect - 영향을 미치다
effect - 효과, 영향, 결과
alternate - 번갈아 하다, 교대의
complement - 보완하다, 보완물
compliment - 칭찬, 칭찬하다
conscious - 의식하는, 의식이 있는
conscientious - 양심적인, 성실한
considerate - 사려 깊은
considerable - 상당한
continual - 반복되는, 거듭되는
continuous - 끊임없는, 연속적인
credible - 믿을 수 있는
credulous - 잘 믿는, 속기 쉬운
economic - 경제의
economical - 절약하는, 경제적인
eminent - 저명한
imminent - 임박한
historic - 역사적으로 중요한
historical - 역사의, 역사적인
imaginary - 상상의, 가상의
imaginative - 상상력이 풍부한
imaginable - 상상할 수 있는
industrial - 산업의
industrious - 근면한
literal - 문자 그대로의
literary - 문학의
literate - 읽고 쓸 줄 아는
precede - 앞서다, 선행하다
proceed - 진행하다, 계속하다
principal - 주요한, 교장
principle - 원리, 원칙
respectable - 존경할 만한, 상당한
respectful - 공손한, 존중하는
respective - 각각의
sensible - 분별 있는, 현명한
sensitive - 민감한, 세심한
sensory - 감각의
successful - 성공적인
successive - 연속적인
comprehensible - 이해할 수 있는
comprehensive - 포괄적인, 종합적인
emigrate - (다른 나라로) 이주하다, 이민 가다
immigrate - (다른 나라에서) 이주해 오다, 이민 오다
lie - 눕다, 거짓말하다, 거짓말
lay - 놓다, 낳다
rise - 오르다, 상승
raise - 올리다, 기르다, 모으다
desert - 사막, 버리다
dessert - 디저트, 후식
loose - 느슨한
lose - 잃다, 지다
moral - 도덕적인, 교훈
morale - 사기, 의욕
personal - 개인의
personnel - 직원, 인사의
stationary - 정지된, 움직이지 않는
stationery - 문구류
comprise - 구성하다, 포함하다
insure - 보험에 들다
expend - 소비하다, 쓰다
statue - 조각상
stature - 키, 위상
status - 지위, 상태
council - 의회, 위원회
counsel - 조언, 상담하다
prosecute - 기소하다
persecute - 박해하다
`
  }
];

/** 단어팩의 단어 목록을 [{ word, meanings }] 형태로 */
function packWordList(pack) {
  if (!pack._parsed) {
    // 난이도 팩(levels.js)은 사전에서 그 난이도의 단어를 가져옴
    pack._parsed = pack.level
      ? levelEntries(pack.level).map(e => ({ word: e.word, meanings: e.meanings.slice() }))
      : parseBulkText(pack.words).items;
  }
  return pack._parsed;
}
